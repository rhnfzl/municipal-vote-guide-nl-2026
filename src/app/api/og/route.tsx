import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const municipality = searchParams.get("municipality") || "Municipality";
  const matches = searchParams.get("matches") || ""; // "PartyA:78,PartyB:65,PartyC:52"
  const format = searchParams.get("format") || "twitter"; // twitter, story, square, linkedin

  const dims: Record<string, { width: number; height: number }> = {
    twitter: { width: 1200, height: 675 },
    story: { width: 1080, height: 1920 },
    square: { width: 1080, height: 1080 },
    linkedin: { width: 1200, height: 628 },
  };

  const { width, height } = dims[format] || dims.twitter;

  const parsedMatches = matches
    .split(",")
    .filter(Boolean)
    .map((m) => {
      const [name, pct] = m.split(":");
      return { name: decodeURIComponent(name), pct: parseFloat(pct) || 0 };
    })
    .slice(0, 5);

  const isVertical = format === "story";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#ffffff",
          fontFamily: "sans-serif",
          padding: isVertical ? "80px 60px" : "40px 60px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: isVertical ? "80px" : "30px",
          }}
        >
          <div
            style={{
              fontSize: isVertical ? 48 : 32,
              fontWeight: 700,
              color: "#1a1a1a",
              marginBottom: "8px",
            }}
          >
            My Vote Match
          </div>
          <div
            style={{
              fontSize: isVertical ? 36 : 24,
              color: "#666666",
            }}
          >
            {municipality}
          </div>
        </div>

        {/* Results */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: isVertical ? "40px" : "16px",
            width: "100%",
            maxWidth: isVertical ? "900px" : "1000px",
          }}
        >
          {parsedMatches.map((match, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <div
                style={{
                  fontSize: isVertical ? 36 : 22,
                  fontWeight: 700,
                  color: i === 0 ? "#2563eb" : "#666",
                  width: isVertical ? "60px" : "40px",
                }}
              >
                #{i + 1}
              </div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div
                  style={{
                    fontSize: isVertical ? 32 : 20,
                    fontWeight: 600,
                    color: "#1a1a1a",
                  }}
                >
                  {match.name}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      height: isVertical ? "24px" : "14px",
                      backgroundColor: "#e5e7eb",
                      borderRadius: "8px",
                      flex: 1,
                      overflow: "hidden",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        width: `${match.pct}%`,
                        height: "100%",
                        backgroundColor:
                          i === 0
                            ? "#2563eb"
                            : i === 1
                              ? "#60a5fa"
                              : "#93c5fd",
                        borderRadius: "8px",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: isVertical ? 32 : 20,
                      fontWeight: 700,
                      color: i === 0 ? "#2563eb" : "#666",
                      minWidth: isVertical ? "100px" : "65px",
                      textAlign: "right",
                    }}
                  >
                    {match.pct}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Watermark */}
        <div
          style={{
            position: "absolute",
            bottom: isVertical ? "60px" : "20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <div
            style={{
              fontSize: isVertical ? 24 : 14,
              color: "#9ca3af",
              fontWeight: 500,
            }}
          >
            municipal-vote-guide-nl-2026
          </div>
          <div
            style={{
              fontSize: isVertical ? 20 : 12,
              color: "#d1d5db",
            }}
          >
            Gemeenteraadsverkiezingen 18 maart 2026
          </div>
        </div>
      </div>
    ),
    { width, height }
  );
}
