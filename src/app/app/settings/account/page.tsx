import { requireActiveWorkspace } from "@/server/service";
import { AccountForms } from "./forms";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const { user } = await requireActiveWorkspace();
  return <AccountForms name={user.name} email={user.email} />;
}
