import Image from "next/image";
import Link from "next/link";

export default function EclatHero() {
  return (
    <section
      aria-labelledby="eclat-hero-title"
      className="relative isolate bg-[#e9e7e3] text-[#181818]"
    >
      <div className="relative aspect-[16/9] w-full">
        <Image
          src="/images/eclat-studio-hero.webp"
          alt="ภาพคอนเซปต์วงดนตรีหญิงเก้าคนในสตูดิโอ สวมฮูดสีขาวโลโก้ Eclat และถือขวดน้ำหอม"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 hidden bg-gradient-to-r from-[#e9e7e3]/80 via-transparent to-transparent md:block" />
      </div>
      <div className="relative px-6 pb-9 pt-6 md:absolute md:inset-y-0 md:left-0 md:flex md:w-[27%] md:flex-col md:justify-center md:px-6 md:py-8 lg:px-8 xl:px-10">
        <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.3em] lg:text-xs">
          Eclat · Studio collection
        </p>
        <h1
          id="eclat-hero-title"
          className="text-4xl font-semibold leading-[1.05] tracking-[-0.035em] md:text-[clamp(2rem,2.9vw,3.5rem)]"
        >
          Your scent.
          <br />
          Your moment.
        </h1>
        <p className="mt-4 max-w-[22rem] text-sm leading-7 text-black/65 lg:mt-6 lg:text-base">
          กลิ่นหอมที่บอกความเป็นคุณ
          <br />
          ค้นพบน้ำหอม Eclat สำหรับทุกวันของคุณ
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4 lg:mt-8">
          <Link
            href="/products"
            className="inline-flex min-h-12 items-center justify-center gap-5 bg-black px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
          >
            ค้นหากลิ่นที่ใช่ <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <p className="mt-5 text-[10px] leading-4 text-black/45">Fan-made visual concept</p>
      </div>
    </section>
  );
}
