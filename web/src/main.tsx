import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRuntime, loadDeployment } from "./config";
import App from "./App";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
root.render(
  <main className="boot">
    <h1>SqueekRaider</h1>
    <p role="status">Loading verified deployment…</p>
  </main>,
);
loadDeployment()
  .then((deployment) => {
    const runtime = createRuntime(deployment);
    const query = new QueryClient({
      defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
    });
    root.render(
      <StrictMode>
        <WagmiProvider config={runtime.wagmi}>
          <QueryClientProvider client={query}>
            <App runtime={runtime} />
          </QueryClientProvider>
        </WagmiProvider>
      </StrictMode>,
    );
  })
  .catch((error) =>
    root.render(
      <main className="boot">
        <h1>SqueekRaider</h1>
        <p role="alert">
          {error instanceof Error
            ? error.message
            : "Deployment verification failed."}
        </p>
        <button onClick={() => location.reload()}>Retry deployment</button>
      </main>,
    ),
  );
