
export function HomeCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="relative  md:w-72 md:h-72 text-center">
      <h3 className="text-3xl font-semibold mb-2 text-gradient transform transition-all duration-500 hover:scale-105 hover:text-purple-800">
        {title}
      </h3>
      <div className="border-4 border-violet-500 border-opacity-50 rounded-lg p-4">
        {description}
      </div>
    </div>
  );
}


