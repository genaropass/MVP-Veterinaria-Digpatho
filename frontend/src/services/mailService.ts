import { API_TOKEN, HOST } from "@/utils/constants";

export async function sendEmail({
  email,
  subject,
  body
}: {
  email: string;
  subject: string;
  body: string;
}) {
  try {
    const res = await fetch(`${HOST}send-email/`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({ email, subject, body }),
    });

    if (!res.ok) {
      throw new Error(`Error al enviar el email: ${res.statusText}`);
    }

    return await res.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
}
