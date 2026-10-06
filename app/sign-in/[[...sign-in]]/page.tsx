import { SignIn } from "@clerk/nextjs";
import { AuthFrame } from "@/components/auth-frame";

export const metadata = { title: "Sign in" };

export default function Page() {
  return (
    <AuthFrame>
      <SignIn />
    </AuthFrame>
  );
}
