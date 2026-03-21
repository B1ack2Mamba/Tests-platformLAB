import dynamic from "next/dynamic";

const WalletFullNoSSR = dynamic(() => import("@/components/WalletFull").then((m) => m.default), {
  ssr: false,
});

export default function WalletPage() {
  return <WalletFullNoSSR />;
}
