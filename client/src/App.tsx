import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";

// Pages
import Home from "@/pages/home";
import Conversation from "@/pages/conversation";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

// Components
import AppShell from "@/components/layout/app-shell";

function App() {
  const [location] = useLocation();

  // Log page navigation for debugging
  useEffect(() => {
    console.log("Navigation:", location);
  }, [location]);

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/conversation/:id" component={Conversation} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

export default App;
