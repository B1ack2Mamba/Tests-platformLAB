import Link from "next/link";

const tariffs = [
  { title: "Пакет услуг оценки — до 30 проектов / месяц", price: "13 500 ₽" },
  { title: "Пакет услуг оценки — до 50 проектов / месяц", price: "18 000 ₽" },
  { title: "Расширенный пакет услуг оценки — до 100 проектов / месяц", price: "30 000 ₽" },
];

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section className="rounded-[28px] border border-[#dcc7a4] bg-[#fffdf9] px-5 py-5 shadow-[0_8px_24px_rgba(120,95,55,0.06)] sm:px-6">
    <h2 id={id} className="text-base font-semibold text-[#274b34] sm:text-lg">{title}</h2>
    <div className="mt-3 space-y-3 text-sm leading-7 text-[#5e6472]">{children}</div>
  </section>
);

export default function OfferPage() {
  return (
    <div className="min-h-screen bg-[#f3f1ec] px-4 py-8 text-[#223127] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-[34px] border border-[#d9c5a3] bg-[#fcfaf6] shadow-[0_14px_40px_rgba(92,74,44,0.08)]">
          <div className="border-b border-[#e5d7bf] bg-[linear-gradient(180deg,#fffdf9_0%,#f7f1e7_100%)] px-6 py-7 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="text-[11px] uppercase tracking-[0.28em] text-[#9b8152]">Публичная информация</div>
                <h1 className="mt-3 text-2xl font-semibold text-[#23412d] sm:text-3xl">
                  Оферта, оплата, возврат, контакты и обработка персональных данных
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#636b78]">
                  На этой странице собраны условия оказания услуг Ждановым Александром Андреевичем: описание пакетов
                  услуг, порядок оформления и оплаты, условия предоставления доступа к функционалу сайта, возврат,
                  контакты, реквизиты и порядок обработки персональных данных.
                </p>
              </div>
              <Link
                href="/"
                className="rounded-full border border-[#d7c19d] bg-white px-4 py-2 text-sm text-[#6d6a62] transition hover:bg-[#faf5eb]"
              >
                На главную
              </Link>
            </div>
          </div>

          <div className="grid gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-8">
            <div className="space-y-5">
              <Section id="service" title="1. Что это за услуга">
                <p>
                  Жданов Александр Андреевич, как самозанятый, оказывает дистанционные информационно-консультационные
                  услуги с использованием собственного цифрового инструмента для автоматизации процессов оценки и
                  аналитической работы.
                </p>
                <p>
                  Сайт используется как авторская рабочая среда исполнителя. Через него заказчик получает доступ к
                  функционалу для создания проектов оценки, использования доступных инструментов, получения цифровых
                  результатов и аналитических материалов в пределах выбранного пакета услуг.
                </p>
                <p>Услуги оказываются дистанционно на территории Российской Федерации через интернет.</p>
              </Section>

              <Section id="tariffs" title="2. Пакеты услуг и стоимость">
                <div className="grid gap-3 sm:grid-cols-1 xl:grid-cols-3">
                  {tariffs.map((tariff) => (
                    <div key={tariff.title} className="rounded-[22px] border border-[#e2cfaf] bg-white px-4 py-4">
                      <div className="text-sm font-semibold text-[#2a4631]">{tariff.title}</div>
                      <div className="mt-2 text-lg font-semibold text-[#8b6b32]">{tariff.price}</div>
                    </div>
                  ))}
                </div>
                <p>
                  Каждый пакет услуг действует 30 дней. После оплаты и выбора пакета заказчику открывается доступ к
                  соответствующему объему функционала сайта и лимиту проектов.
                </p>
              </Section>

              <Section id="order" title="3. Оформление заказа и оплата">
                <ol className="list-decimal space-y-2 pl-5">
                  <li>Заказчик регистрируется или авторизуется на сайте.</li>
                  <li>Выбирает пакет услуг и подтверждает заказ.</li>
                  <li>Оплачивает услугу доступным на сайте безналичным способом.</li>
                  <li>После успешной оплаты и выбора пакета доступ активируется сразу.</li>
                </ol>
                <p>
                  Стоимость указывается на сайте в рублях Российской Федерации. Актуальная цена отображается до
                  подтверждения оплаты.
                </p>
              </Section>

              <Section id="rendering" title="4. Когда услуга считается оказанной">
                <p>
                  Услуга считается начавшейся с момента предоставления заказчику доступа к выбранному пакету услуг и
                  возможности использовать функционал сайта для создания и ведения проектов оценки.
                </p>
                <p>
                  Фактом оказания услуги также считается предоставление заказчику доступа к цифровым результатам,
                  аналитическим и интерпретационным материалам в пределах оплаченного пакета услуг.
                </p>
              </Section>

              <Section id="refund" title="5. Возврат и отказ от покупки">
                <p>
                  Возврат денежных средств рассматривается индивидуально с учетом фактически предоставленного доступа и
                  объема использованного функционала. Запрос на возврат необходимо направить на контактный email с
                  темой письма, позволяющей идентифицировать обращение по оплате.
                </p>
                <div className="rounded-[22px] border border-[#ead8bc] bg-[#fffaf1] px-4 py-4">
                  <div className="font-medium text-[#2e4935]">Что указать в обращении:</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>ФИО;</li>
                    <li>дату оплаты;</li>
                    <li>сумму оплаты;</li>
                    <li>причину обращения.</li>
                  </ul>
                </div>
                <ol className="list-decimal space-y-2 pl-5">
                  <li>Покупатель направляет обращение по email.</li>
                  <li>Обращение рассматривается исполнителем индивидуально.</li>
                  <li>Ответ направляется в течение суток.</li>
                  <li>При положительном решении деньги возвращаются в течение суток.</li>
                </ol>
                <p>
                  До начала фактического использования услуги возврат возможен; после предоставления доступа и начала
                  использования вопрос рассматривается по существу обращения.
                </p>
              </Section>

              <Section id="personal-data" title="6. Политика обработки персональных данных">
                <p>
                  Используя сайт, пользователь соглашается на обработку персональных данных, необходимых для
                  регистрации, оплаты, предоставления доступа к функционалу сайта, обратной связи и рассмотрения
                  обращений.
                </p>
                <p>
                  К таким данным могут относиться: ФИО, email, телефон, сведения об оплате, а также данные,
                  добровольно указанные пользователем в формах сайта.
                </p>
                <p>
                  Персональные данные используются только для оказания услуг, исполнения обязательств, обработки
                  платежей, обратной связи и выполнения требований законодательства РФ.
                </p>
                <p>
                  Пользователь вправе обратиться с запросом об уточнении, изменении или удалении своих данных по
                  контактному email, указанному на этой странице.
                </p>
              </Section>
            </div>

            <div className="space-y-5">
              <Section id="contacts" title="Контакты и реквизиты">
                <div className="space-y-2">
                  <div><span className="font-medium text-[#263d2d]">Исполнитель:</span> Жданов Александр Андреевич</div>
                  <div><span className="font-medium text-[#263d2d]">Статус:</span> самозанятый</div>
                  <div><span className="font-medium text-[#263d2d]">ИНН:</span> 027803490580</div>
                  <div><span className="font-medium text-[#263d2d]">Email:</span> san.real96@gmail.com</div>
                  <div><span className="font-medium text-[#263d2d]">Телефон:</span> 89272345176</div>
                </div>
              </Section>

              <Section id="client-path" title="Путь покупателя">
                <ul className="space-y-2">
                  <li><span className="font-medium text-[#263d2d]">Заказ:</span> заказчик выбирает пакет услуг на сайте и переходит к оплате.</li>
                  <li><span className="font-medium text-[#263d2d]">Оплата:</span> производится безналично через подключенный платежный сервис.</li>
                  <li><span className="font-medium text-[#263d2d]">Оказание услуги:</span> доступ к пакету услуг открывается сразу после оплаты.</li>
                  <li><span className="font-medium text-[#263d2d]">Отказ / возврат:</span> по email с описанием ситуации и данными платежа.</li>
                </ul>
              </Section>

              <Section id="response-time" title="Сроки ответа">
                <p>
                  По обращениям, не связанным с возвратом, срок ответа составляет до 3 рабочих дней. По запросам о
                  возврате ответ направляется в течение суток.
                </p>
              </Section>

              <div className="rounded-[28px] border border-dashed border-[#d8c39f] bg-[#fff8ed] px-5 py-5 text-sm leading-7 text-[#6d685f]">
                Эта страница предназначена для публичного размещения на сайте и может использоваться как единый
                раздел для модерации платежного сервиса: описание услуг, стоимость, оплата, возврат, контакты,
                реквизиты и данные о персональных данных собраны в одном месте.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
