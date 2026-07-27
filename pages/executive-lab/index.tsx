import type { GetServerSideProps } from "next";
import Head from "next/head";

import ExecutiveLabWorkspacePage from "../../components/executive-lab/ExecutiveLabWorkspace";
import { isExecutiveLabEnabled } from "../../lib/executiveLab";

export default function ExecutiveLabPage() {
  return (
    <>
      <Head>
        <title>Executive Space Lab</title>
        <meta
          name="description"
          content="Изолированный экспериментальный 3D-кабинет на отдельном Supabase"
        />
      </Head>
      <ExecutiveLabWorkspacePage />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  if (!isExecutiveLabEnabled()) return { notFound: true };
  return { props: {} };
};
