import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ identifier: string }>;
}

export default async function ProjectIndexPage({ params }: PageProps) {
  const { identifier } = await params;
  redirect(`/projects/${identifier}/overview`);
}
