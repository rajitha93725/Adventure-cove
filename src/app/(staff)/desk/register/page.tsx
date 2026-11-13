"use client";
import { useRouter } from "next/navigation";
import FamilyForm from "@/components/family-form";
import { registerFamilyAction } from "../actions";

export default function DeskRegisterPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="h1">Register new family</h1>
      <FamilyForm
        action={registerFamilyAction}
        submitLabel="Register & continue to check-in"
        onDone={(id) => router.push(`/desk/family/${id}?new=1`)}
      />
    </div>
  );
}
