import Link from "next/link";
import { Layout } from "@/components/Layout";
import { TestTakeAction } from "@/components/TestTakeAction";
import { getAllTests } from "@/lib/loadTests";
import { getTestTakePriceRub } from "@/lib/testTakeAccess";
import type { AnyTest } from "@/lib/testTypes";

type AssessmentCatalogItem = Pick<AnyTest, "slug" | "title" | "description">;

export default function AssessmentsPage({ tests, takePriceRub }: { tests: AssessmentCatalogItem[]; takePriceRub: number }) {
  return (
    <Layout title="Каталог тестов">
      <div className="mb-4 card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm leading-6 text-slate-700">
            Здесь собран коммерческий каталог тестов. Формат: один тест + краткая интерпретация из методички. Каждое прохождение стоит {takePriceRub} ₽ и оплачивается с внутреннего кошелька при новом запуске.
          </div>
          <Link href="/results" className="btn btn-secondary shrink-0">
            Мои результаты
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {tests.map((test) => (
          <div key={test.slug} className="card">
            <div className="text-lg font-semibold text-slate-950">{test.title}</div>
            <div className="mt-1 text-xs text-slate-500">slug: {test.slug}</div>
            {test.description ? <div className="mt-3 text-sm leading-6 text-slate-700">{test.description}</div> : null}
            <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-sm leading-5 text-emerald-800">
              Один тест + краткая интерпретация из методички после прохождения.
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/tests/${test.slug}`} className="btn btn-primary">Описание</Link>
              <TestTakeAction slug={test.slug} compact />
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}

export async function getServerSideProps() {
  const tests = (await getAllTests()).map((test) => ({
    slug: test.slug,
    title: test.title,
    description: test.description || "",
  }));
  return { props: { tests, takePriceRub: getTestTakePriceRub() } };
}
