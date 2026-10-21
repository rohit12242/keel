import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Reset your password · Keel" };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
