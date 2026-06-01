import { useEffect, useState } from "react";
import { buyProduct, fetchShopProducts, type ProductPreview, type User } from "../api";

type Props = {
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
};

function gainsLabel(p: ProductPreview): string {
  const parts: string[] = [];
  if (p.gains?.hunger) parts.push(`+${p.gains.hunger} сытость`);
  if (p.gains?.energy) parts.push(`+${p.gains.energy} энергия`);
  if (p.gains?.mood) parts.push(`+${p.gains.mood} настроение`);
  if (p.gains?.health) parts.push(`+${p.gains.health} здоровье`);
  return parts.join(" · ");
}

export function ProductsShop({ user, setUser, onToast }: Props) {
  const [items, setItems] = useState<ProductPreview[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const data = await fetchShopProducts();
    setItems(data.previews);
  };

  useEffect(() => {
    reload()
      .catch((e) => onToast(e instanceof Error ? e.message : "Ошибка", true))
      .finally(() => setLoading(false));
  }, [onToast]);

  const onBuy = async (id: string) => {
    setBusy(id);
    try {
      const r = await buyProduct(id);
      setUser(r.user);
      onToast(r.message);
      await reload();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <p className="shop-stub">Загрузка…</p>;
  }

  return (
    <div className="products-shop">
      <p className="products-shop-lead">Еда и напитки восстанавливают показатели.</p>
      <ul className="products-list">
        {items.map((p) => (
          <li key={p.id} className="card product-card">
            <div className="product-card-head">
              <h3>{p.title}</h3>
              <span className="product-price">{p.priceRub.toLocaleString("ru-RU")} ₽</span>
            </div>
            <p className="product-desc">{p.description}</p>
            {p.gains && <p className="product-gains">{gainsLabel(p)}</p>}
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy != null}
              onClick={() => {
                if (!p.canBuy) {
                  onToast(p.blockReason ?? "Нельзя купить", true);
                  return;
                }
                void onBuy(p.id);
              }}
            >
              {busy === p.id ? "…" : "Купить"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
