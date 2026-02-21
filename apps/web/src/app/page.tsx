import { CONTRACT_VERSION } from '@comicstrunk/contracts';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">Comics Trunk</h1>
      <p className="mt-4 text-lg text-gray-600">
        Plataforma para colecionadores de quadrinhos
      </p>
      <p className="mt-2 text-sm text-gray-400">
        Contracts v{CONTRACT_VERSION}
      </p>
    </main>
  );
}
