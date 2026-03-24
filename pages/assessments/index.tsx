import Link from "next/link";
import { Layout } from "@/components/Layout";
import { TestTakeAction } from "@/components/TestTakeAction";
import { getAllTests } from "@/lib/loadTests";
import type { AnyTest } from "@/lib/testTypes";

export default function AssessmentsPage({ tests }: { tests: AnyTest[] }) {
  return (
    <Layout title="Каталог тестов">
      <div className="mb-4 card text-sm text-slate-700">
        Здесь собран коммерческий каталог тестов. Каждое прохождение теста оплачивается отдельно: 99 ₽ списываются с внутреннего кошелька при каждом новом запуске.
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {tests.map((test) => (
          <div key={test.slug} className="card">
            <div className="text-lg font-semibold text-slate-950">{test.title}</div>
            <div className="mt-1 text-xs text-slate-500">slug: {test.slug}</div>
            {test.description ? <div className="mt-3 text-sm leading-6 text-slate-700">{test.description}</div> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/tests/${test.slug}`} className="btn btn-primary">Результаты</Link>
              <TestTakeAction slug={test.slug} compact />
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
