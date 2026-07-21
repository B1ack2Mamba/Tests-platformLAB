import type { GetServerSideProps } from "next";
import Head from "next/head";

import ProjectFolderAnimationStudy from "../../components/indi3d/ProjectFolderAnimationStudy";

const INDI_SUPABASE_REF = "npgrkyqtgdhzdsabkhxg";

export default function ProjectFolderStudyPage() {
  return (
    <>
      <Head>
        <title>Анимация папки проектов · Indi Lab</title>
        <meta name="description" content="Изолированное исследование 3D-анимации рабочей папки проектов" />
      </Head>
      <ProjectFolderAnimationStudy />
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
