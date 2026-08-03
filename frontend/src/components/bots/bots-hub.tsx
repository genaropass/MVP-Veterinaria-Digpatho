"use client";

import { Microscope, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScientificBotView } from "./scientific-bot-view";
import { GenialBotView } from "./genial-bot-view";
import { BotsApiBanner } from "./bots-api-banner";
import { useBotsApi } from "@/context/bots-api-context";

export function BotsHub() {
  const { apiMode } = useBotsApi();

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Asistentes Digpatho</h1>
        <p className="mt-1 text-muted-foreground">
          Bot Científico (evidencia) y Bot Genial (red). Conectados al backend cuando{" "}
          <code className="text-xs">GET /bot/health</code> responde OK.
        </p>
      </header>

      <BotsApiBanner mode={apiMode} />

      <Tabs defaultValue="cientifico">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="cientifico" className="gap-2">
            <Microscope className="h-4 w-4" />
            Científico
          </TabsTrigger>
          <TabsTrigger value="genial" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Genial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cientifico" className="mt-6">
          <ScientificBotView />
        </TabsContent>

        <TabsContent value="genial" className="mt-6">
          <GenialBotView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
