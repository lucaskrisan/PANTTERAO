import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const REDIRECT_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/ab-redirect`;

export default function Go() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (slug) {
      if (slug === "track.js") {
        window.location.replace(`https://${PROJECT_ID}.supabase.co/functions/v1/ab-tracking`);
        return;
      }
      const utms = searchParams.toString();
      const finalUrl = `${REDIRECT_BASE}/${slug}?${utms}`;
      window.location.replace(finalUrl);
    }
  }, [slug, searchParams]);

  return null;
}
