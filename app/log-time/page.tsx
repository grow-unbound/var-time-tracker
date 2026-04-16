import { permanentRedirect } from "next/navigation";

export default function LogTimeRedirectPage(): never {
  permanentRedirect("/log");
}
