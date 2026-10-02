"use client";
import { useEffect, useState } from "react";
import { CldImage } from "next-cloudinary";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useFavorite } from "../context/FavoriteContext";
import { CatalogInventory, lowestAvailablePrice } from "@/lib/catalog";

interface ProductCardProps {
  product: {
    id: number;
    title: string;
    images: string[];
    isNew: boolean;
    Inventory: CatalogInventory[];
    isFavorite?: boolean;
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  const { status } = useSession();
  const router = useRouter();
  const { increaseFavoriteCount, decreaseFavoriteCount } = useFavorite();
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorited, setIsFavorited] = useState(product.isFavorite ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lowestPrice = lowestAvailablePrice(product.Inventory ?? []);
  useEffect(() => {
    setIsFavorited(status === "authenticated" && !!product.isFavorite);
  }, [product.isFavorite, status]);

  const toggleFavorite = async () => {
    if (status === "unauthenticated") {
      router.push("/signin");
      return;
    }
    if (status !== "authenticated" || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/favorites", {
        method: isFavorited ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      if (!response.ok) throw new Error("ไม่สามารถเปลี่ยนรายการโปรดได้");
      if (isFavorited) decreaseFavoriteCount();
      else increaseFavoriteCount();
      setIsFavorited(!isFavorited);
    } catch (error) {
      setError(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="border rounded-lg p-4 max-w-xs flex flex-col relative w-[250px] min-h-[350px]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {product.isNew && (
        <span className="absolute top-0 left-0 bg-lime-400 text-black text-xs font-bold px-2 py-1 z-10">
          NEW
        </span>
      )}
      <Link href={`/products/${product.id}`} className="flex flex-col flex-1">
        <div className="relative h-64 w-full mb-4">
          {product.images?.length ? (
            <CldImage
              src={isHovered && product.images.length > 1 ? product.images[1] : product.images[0]}
              alt={product.title}
              width={300}
              height={300}
              className="object-cover rounded-lg w-full h-full"
            />
          ) : (
            <div className="bg-gray-200 h-full rounded-lg flex items-center justify-center">
              No Image
            </div>
          )}
          {lowestPrice === null && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
              <span className="text-white font-bold">Out of Stock</span>
            </div>
          )}
        </div>
        <div className="mt-auto">
          <h3 className="text-lg font-semibold">{product.title}</h3>
          {lowestPrice !== null && <p className="text-lg font-bold">฿{lowestPrice}</p>}
        </div>
      </Link>
      <button
        type="button"
        className="absolute top-6 right-6 text-red-500 z-20"
        onClick={toggleFavorite}
        disabled={saving || status === "loading"}
        aria-label={isFavorited ? "นำออกจากรายการโปรด" : "เพิ่มรายการโปรด"}
        aria-pressed={isFavorited}
      >
        <Icon icon={isFavorited ? "mdi:heart" : "mdi:heart-outline"} width={30} height={30} />
      </button>
      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
