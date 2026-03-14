#!/usr/bin/env python3
"""
Topic Modeling Script for Municipal Vote Guide NL 2026
Uses BERTopic on Dutch political statement titles to discover topic clusters.
Outputs JSON files for interactive web visualizations.
"""

import json
import os
import sys
import numpy as np
from pathlib import Path

# Project paths
ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "public" / "data" / "municipalities"
INDEX_PATH = ROOT / "public" / "data" / "index.json"
OUTPUT_DIR = ROOT / "public" / "data" / "topics"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("=== Topic Modeling for Municipal Vote Guide ===\n")

# Step 1: Load all unique Dutch statement titles
print("Step 1: Loading statement data...")
index = json.loads(INDEX_PATH.read_text())

docs = []  # list of statement titles
doc_meta = []  # metadata for each doc

seen_titles = set()
for entry in index:
    nl_path = DATA_DIR / entry["slug"] / "nl.json"
    if not nl_path.exists():
        continue
    data = json.loads(nl_path.read_text())
    for stmt in data.get("statements", []):
        title = stmt.get("title", "").strip()
        if not title or title in seen_titles:
            continue
        seen_titles.add(title)
        docs.append(title)
        doc_meta.append({
            "title": title,
            "theme": stmt.get("theme", ""),
            "themeId": stmt.get("themeId", ""),
            "id": stmt.get("id", 0),
        })

print(f"  Loaded {len(docs)} unique statement titles")

# Step 2: Run BERTopic with OpenAI text-embedding-3-large
print("\nStep 2: Running BERTopic...")
print("  Using OpenAI text-embedding-3-large embeddings...")

from bertopic import BERTopic
from umap import UMAP
from hdbscan import HDBSCAN
from sklearn.feature_extraction.text import CountVectorizer
import openai

# Load OpenAI API key
env_path = ROOT / ".env_openai"
env_content = env_path.read_text()
api_key = None
for line in env_content.strip().split("\n"):
    if line.startswith("OPENAI_API_KEY"):
        api_key = line.split("=", 1)[1].strip().strip("'\"")
        break

if not api_key:
    print("  ERROR: OPENAI_API_KEY not found in .env_openai")
    sys.exit(1)

client = openai.OpenAI(api_key=api_key)

# Cache embeddings to avoid re-computing
EMBEDDINGS_CACHE = ROOT / "data" / "embeddings-cache.npy"

if EMBEDDINGS_CACHE.exists():
    print("  Loading cached embeddings...")
    embeddings = np.load(str(EMBEDDINGS_CACHE))
    if len(embeddings) != len(docs):
        print(f"  Cache size mismatch ({len(embeddings)} != {len(docs)}), recomputing...")
        EMBEDDINGS_CACHE.unlink()
        embeddings = None
    else:
        print(f"  Loaded {len(embeddings)} cached embeddings (dim={embeddings.shape[1]})")
else:
    embeddings = None

if embeddings is None:
    print(f"  Computing embeddings for {len(docs)} documents via OpenAI API...")
    all_embeddings = []
    batch_size = 100
    for i in range(0, len(docs), batch_size):
        batch = docs[i:i + batch_size]
        response = client.embeddings.create(
            model="text-embedding-3-large",
            input=batch,
        )
        batch_embeddings = [e.embedding for e in response.data]
        all_embeddings.extend(batch_embeddings)
        print(f"    Batch {i // batch_size + 1}/{(len(docs) + batch_size - 1) // batch_size}: {len(batch)} texts embedded")

    embeddings = np.array(all_embeddings)
    # Cache for reuse
    np.save(str(EMBEDDINGS_CACHE), embeddings)
    print(f"  Embeddings cached to {EMBEDDINGS_CACHE} ({embeddings.shape})")

# Configure BERTopic components
umap_model = UMAP(
    n_neighbors=15,
    n_components=2,  # 2D for scatter plot
    min_dist=0.1,
    metric="cosine",
    random_state=42,
)

hdbscan_model = HDBSCAN(
    min_cluster_size=5,
    min_samples=3,
    metric="euclidean",
    prediction_data=True,
)

vectorizer = CountVectorizer(
    ngram_range=(1, 3),
    stop_words=None,
    min_df=2,
)

topic_model = BERTopic(
    umap_model=umap_model,
    hdbscan_model=hdbscan_model,
    vectorizer_model=vectorizer,
    min_topic_size=5,
    nr_topics="auto",
    verbose=True,
)

print("  Fitting BERTopic model...")
topics, probs = topic_model.fit_transform(docs, embeddings)

topic_info = topic_model.get_topic_info()
print(f"\n  Found {len(topic_info) - 1} topics (excluding outliers)")
print(f"  Outlier documents: {sum(1 for t in topics if t == -1)}")

# Step 3: Extract UMAP 2D coordinates
print("\nStep 3: Extracting 2D coordinates for scatter plot...")
reduced = umap_model.transform(embeddings) if hasattr(umap_model, 'transform') else UMAP(
    n_neighbors=15, n_components=2, min_dist=0.1, metric="cosine", random_state=42
).fit_transform(embeddings)

coordinates = []
for i, (x, y) in enumerate(reduced):
    coordinates.append({
        "x": round(float(x), 4),
        "y": round(float(y), 4),
        "topic": int(topics[i]),
        "title": docs[i][:100],
        "theme": doc_meta[i]["theme"],
    })

# Step 4: Build topic list with keywords
print("\nStep 4: Building topic data...")
topics_data = []
for _, row in topic_info.iterrows():
    topic_id = int(row["Topic"])
    if topic_id == -1:
        continue  # Skip outlier topic

    topic_words = topic_model.get_topic(topic_id)
    keywords = [{"word": w, "score": round(float(s), 4)} for w, s in topic_words[:10]]

    # Get representative documents
    rep_docs = []
    for i, t in enumerate(topics):
        if t == topic_id and len(rep_docs) < 5:
            rep_docs.append(docs[i][:120])

    # Calculate which themes this topic covers
    theme_counts = {}
    for i, t in enumerate(topics):
        if t == topic_id:
            theme = doc_meta[i]["theme"]
            theme_counts[theme] = theme_counts.get(theme, 0) + 1

    top_themes = sorted(theme_counts.items(), key=lambda x: -x[1])[:5]

    topics_data.append({
        "id": topic_id,
        "label": " | ".join([kw["word"] for kw in keywords[:3]]),
        "count": int(row["Count"]),
        "keywords": keywords,
        "representativeDocs": rep_docs,
        "topThemes": [{"theme": t, "count": c} for t, c in top_themes],
    })

# Step 5: Build hierarchical topic tree
print("\nStep 5: Building topic hierarchy...")
try:
    hierarchical_topics = topic_model.hierarchical_topics(docs)
    hierarchy = []
    for _, row in hierarchical_topics.iterrows():
        hierarchy.append({
            "parent": int(row["Parent_ID"]),
            "child_left": int(row["Topics"][0]) if len(row["Topics"]) > 0 else -1,
            "child_right": int(row["Topics"][1]) if len(row["Topics"]) > 1 else -1,
            "distance": round(float(row["Distance"]), 4),
        })
except Exception as e:
    print(f"  Warning: Hierarchy extraction failed: {e}")
    hierarchy = []

# Step 6: Calculate topic similarity matrix
print("\nStep 6: Calculating topic similarity...")
try:
    sim_matrix = topic_model.topic_embeddings_
    if sim_matrix is not None:
        from sklearn.metrics.pairwise import cosine_similarity
        # Get topic embeddings (excluding outlier -1)
        topic_ids = [t["id"] for t in topics_data]
        valid_indices = [i + 1 for i in range(len(topic_ids))]  # +1 because -1 is index 0

        if len(valid_indices) > 1 and max(valid_indices) < len(sim_matrix):
            topic_embeds = sim_matrix[valid_indices]
            sim = cosine_similarity(topic_embeds)

            similarity = {
                "topicIds": topic_ids,
                "matrix": [[round(float(v), 3) for v in row] for row in sim],
            }
        else:
            similarity = {"topicIds": [], "matrix": []}
    else:
        similarity = {"topicIds": [], "matrix": []}
except Exception as e:
    print(f"  Warning: Similarity calculation failed: {e}")
    similarity = {"topicIds": [], "matrix": []}

# Step 7: Save outputs
print("\nStep 7: Saving output files...")

(OUTPUT_DIR / "topics.json").write_text(
    json.dumps(topics_data, indent=2, ensure_ascii=False)
)
print(f"  topics.json: {len(topics_data)} topics")

(OUTPUT_DIR / "coordinates.json").write_text(
    json.dumps(coordinates, indent=2, ensure_ascii=False)
)
print(f"  coordinates.json: {len(coordinates)} points")

(OUTPUT_DIR / "hierarchy.json").write_text(
    json.dumps(hierarchy, indent=2, ensure_ascii=False)
)
print(f"  hierarchy.json: {len(hierarchy)} hierarchy entries")

(OUTPUT_DIR / "similarity.json").write_text(
    json.dumps(similarity, indent=2, ensure_ascii=False)
)
print(f"  similarity.json: {len(similarity.get('topicIds', []))} topics")

# Step 8: Create English translations of topic labels
print("\nStep 8: Generating English translations...")
# Use translation cache if available
cache_path = ROOT / "data" / "translation-cache.json"
cache = {}
if cache_path.exists():
    cache = json.loads(cache_path.read_text())

topics_en = []
for topic in topics_data:
    label_en = cache.get(topic["label"], topic["label"])
    keywords_en = []
    for kw in topic["keywords"]:
        translated = cache.get(kw["word"], kw["word"])
        keywords_en.append({"word": translated, "score": kw["score"]})
    rep_docs_en = [cache.get(d, d) for d in topic["representativeDocs"]]
    top_themes_en = [
        {"theme": cache.get(t["theme"], t["theme"]), "count": t["count"]}
        for t in topic["topThemes"]
    ]

    topics_en.append({
        "id": topic["id"],
        "label": label_en,
        "count": topic["count"],
        "keywords": keywords_en,
        "representativeDocs": rep_docs_en,
        "topThemes": top_themes_en,
    })

(OUTPUT_DIR / "topics_en.json").write_text(
    json.dumps(topics_en, indent=2, ensure_ascii=False)
)
print(f"  topics_en.json: {len(topics_en)} translated topics")

print(f"\n{'='*60}")
print(f"TOPIC MODELING COMPLETE")
print(f"  Topics discovered: {len(topics_data)}")
print(f"  Outlier statements: {sum(1 for t in topics if t == -1)}")
print(f"  Output: {OUTPUT_DIR}")
print(f"{'='*60}")
