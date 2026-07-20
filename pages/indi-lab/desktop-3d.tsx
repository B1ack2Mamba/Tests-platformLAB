import type { GetServerSideProps } from "next";
import Head from "next/head";

import IndiDesktop3D from "../../components/indi3d/IndiDesktop3D";

const INDI_SUPABASE_REF = "npgrkyqtgdhzdsabkhxg";

export default function IndiDesktop3DPage() {
  return (
    <>
      <Head>
        <title>3D-рабочий стол · Indi Lab</title>
        <meta name="description" content="Экспериментальный 3D-кабинет Лаборатории кадров" />
      </Head>
      <IndiDesktop3D />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const explicitlyEnabled = process.env.INDI_3D_LAB_ENABLED === "1";
  const isIndiProject = supabaseUrl.includes(INDI_SUPABASE_REF);

  if (!explicitlyEnabled && !isIndiProject) return { notFound: true };
  return { props: {} };
};
