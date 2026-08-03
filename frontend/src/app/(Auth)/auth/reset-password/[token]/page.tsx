import ResetPassword from "./reset-password";

// Usamos any para que TypeScript deje de quejarse
const Page = async ({ params }: any) => {
  const { token } = params;

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-center mb-6 text-foreground">
        Reset password
      </h1>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-background px-2 text-muted-foreground">
            Enter your new password to reset your password.
          </span>
        </div>
      </div>

      <ResetPassword token={token} />
    </div>
  );
};

export default Page;


