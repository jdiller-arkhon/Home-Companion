import { requireUser } from "@/server/auth";
import { MabelGallery } from "@/components/mabel-gallery";
import { PageHeader } from "@/components/ui";

export default async function MeetMabel() {
  await requireUser();
  return (
    <div className="mx-auto max-w-[1100px] px-5 md:px-10 pt-10 md:pt-14 pb-12">
      <PageHeader title="Meet Mabel" subtitle="Live previews of each of her states." />
      <MabelGallery />
    </div>
  );
}
