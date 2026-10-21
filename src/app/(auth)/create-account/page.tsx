import type { Metadata } from "next";
import { CreateAccountForm } from "./CreateAccountForm";

export const metadata: Metadata = { title: "Create account · Keel" };

export default function CreateAccountPage() {
  return <CreateAccountForm />;
}
