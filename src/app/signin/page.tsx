import { Suspense } from "react";
import PageClient from "./PageClient";
import Loading from "@/app/components/Loading";
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PageClient />
    </Suspense>
  );
}
