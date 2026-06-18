import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findSeed, SEED_MARKETS } from "@/lib/predict/seed";
import MarketDetail from "@/components/predict/MarketDetail";

export function generateStaticParams() {
  return SEED_MARKETS.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const seed = findSeed(slug);
  if (!seed) return { title: "Market not found · Theseus Predict" };
  return {
    title: `${seed.question} · Theseus Predict`,
    description: seed.description,
  };
}

export default async function Page(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const seed = findSeed(slug);
  if (!seed) notFound();
  return <MarketDetail slug={slug} />;
}
