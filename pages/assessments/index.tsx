import Link from "next/link";
import { Layout } from "@/components/Layout";
import { getAllTests } from "@/lib/loadTests";
import type { AnyTest } from "@/lib/testTypes";

export default function AssessmentsPage({ tests }: { tests: AnyTest[] }) {
  return (
    <Layout title="Каталог тестов">
      <div className="mb-4 card text-sm text-slate-700">
        Здесь собран коммерческий каталог тестов. На старте ты можешь использовать уже готовое ядро,
        а позже добавлять роли, проекты, вакансии и оплату поверх этого списка.
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {tests.map((test) => (
          <div key={test.slug} className="card">
            <div className="text-lg font-semibold text-slate-950">{test.title}</div>
            <div className="mt-1 text-xs text-slate-500">slug: {test.slug}</div>
            {test.description ? <div className="mt-3 text-sm leading-6 text-slate-700">{test.description}</div> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/tests/${test.slug}`} className="btn btn-primary">Открыть</Link>
              <Link href={`/tests/${test.slug}/take`} className="btn btn-secondary">Пройти сразу</Link>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}

export async function getServerSideProps() {
  const tests = await getAllTests();
  return { props: { tests } };
}
