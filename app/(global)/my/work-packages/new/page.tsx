import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PersonalWorkPackageForm } from "@/components/work-packages/PersonalWorkPackageForm";
import { isModuleEnabledForUser } from "@/lib/services/feature-flags";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

export default async function NewPersonalWorkPackagePage() {
  const { snapshot, currentUser } = await getShellRequestContext();
  const enabled = await isModuleEnabledForUser("personalWorkPackage", currentUser);
  if (!enabled) {
    redirect("/my/page");
  }

  const projects = currentUser
    ? snapshot.projects.filter(
        (project) =>
          currentUser.managedProjectIds.includes(project.id) ||
          currentUser.participatingProjectIds.includes(project.id)
      )
    : snapshot.projects;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "我的工作", href: "/my/page" },
          { label: "新建工作项" }
        ]}
      />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">新建工作项</h1>
          <p className="page-subtitle">
            可创建纯个人事项，也可以直接挂到你可见的项目中。
          </p>
        </div>
      </header>
      <PersonalWorkPackageForm
        currentUser={currentUser}
        projects={projects}
        people={snapshot.people}
      />
    </>
  );
}
