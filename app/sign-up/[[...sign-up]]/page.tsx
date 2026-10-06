import { SignUp } from "@clerk/nextjs";
import { AuthFrame } from "@/components/auth-frame";

export const metadata = { title: "Create your account" };

export default function Page() {
  return (
    <AuthFrame>
      <SignUp />
    </AuthFrame>
  );
}
