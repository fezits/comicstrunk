export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Centered card layout for auth pages - no sidebar, no header */}
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
