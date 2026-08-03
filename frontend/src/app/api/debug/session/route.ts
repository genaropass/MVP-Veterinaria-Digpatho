import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  
  return Response.json({
    session: {
      ...session,
      accessToken: session ? (session as any).accessToken : "N/A",
    },
    hasAccessToken: session ? !!(session as any).accessToken : false,
    tokenPreview: session && (session as any).accessToken 
      ? (session as any).accessToken.substring(0, 50) + "..." 
      : "NO TOKEN",
  });
}
