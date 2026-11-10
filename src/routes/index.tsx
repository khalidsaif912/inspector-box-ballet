import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "مستودع الشحن الجوي الدولي" },
      { name: "description", content: "لعبة فرز شحنات جوية ومواد خطرة وفق قواعد IATA." },
      { property: "og:title", content: "مستودع الشحن الجوي الدولي" },
      { property: "og:description", content: "لعبة فرز شحنات جوية ومواد خطرة وفق قواعد IATA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/game.html"
      title="مستودع الشحن الجوي"
      className="fixed inset-0 h-full w-full border-0 bg-background"
      allow="autoplay; fullscreen"
    />
  );
}
