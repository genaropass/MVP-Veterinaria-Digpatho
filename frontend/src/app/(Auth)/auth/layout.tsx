const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-lg border border-border p-6 space-y-6">
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;
