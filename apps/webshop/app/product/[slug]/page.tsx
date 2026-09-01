import { notFound } from "next/navigation";
import { fetchProduct } from "@/lib/api";
import { ProductDetailView } from "@/components/ProductDetailView";

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await fetchProduct(params.slug);
  if (!product) notFound();
  return <ProductDetailView product={product} />;
}
