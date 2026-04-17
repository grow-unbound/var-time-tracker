import { redirect } from "next/navigation";

export default function AllEntriesRedirectPage(): never {
  redirect("/entries");
}
