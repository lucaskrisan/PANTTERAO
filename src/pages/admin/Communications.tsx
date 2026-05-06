import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Plus } from "lucide-react";

const Communications = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Comunicações</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure seus provedores de comunicação</p>
      </div>

      <Tabs defaultValue="email">
        <TabsList>
          <TabsTrigger value="email">Provedor de Email</TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display">Provedor de Email</CardTitle>
              <p className="text-xs text-muted-foreground">Configure seu provedor de e-mail</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Mail className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">Nenhum item encontrado</p>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Adicionar Provedor de Email
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Communications;
