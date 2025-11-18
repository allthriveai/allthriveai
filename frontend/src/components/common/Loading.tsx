export function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
        <p className="mt-4 text-lg text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
