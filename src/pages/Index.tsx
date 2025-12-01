import { Link } from "react-router-dom";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Shield, Phone, LogIn } from "lucide-react";

const Index = () => {
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Navigation */}
      <nav className="border-b border-border/50 bg-card/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">InsuranceCare</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setShowAuthDialog(true)}>
              <LogIn className="mr-2 w-4 h-4" />
              Login
            </Button>
            <Link to="/claim">
              <Button variant="default">File a Claim</Button>
            </Link>
            <Link to="/admin">
              <Button variant="outline">Admin Dashboard</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Auth Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Welcome Back</DialogTitle>
            <DialogDescription>
              Sign in to your account or create a new one
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input 
                  id="login-email" 
                  type="email" 
                  placeholder="name@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input 
                  id="login-password" 
                  type="password" 
                  placeholder="••••••••"
                />
              </div>
              <Button className="w-full" size="lg">
                Sign In
              </Button>
              <Button variant="link" className="w-full text-sm text-muted-foreground">
                Forgot password?
              </Button>
            </TabsContent>
            
            <TabsContent value="signup" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Full Name</Label>
                <Input 
                  id="signup-name" 
                  type="text" 
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input 
                  id="signup-email" 
                  type="email" 
                  placeholder="name@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input 
                  id="signup-password" 
                  type="password" 
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-confirm">Confirm Password</Label>
                <Input 
                  id="signup-confirm" 
                  type="password" 
                  placeholder="••••••••"
                />
              </div>
              <Button className="w-full" size="lg">
                Create Account
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center space-y-6 mb-16">
          <h2 className="text-5xl font-bold text-foreground animate-fade-in">
            Your Trusted Insurance Partner
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "0.1s" }}>
            Fast, efficient claim processing powered by AI. Get help when you need it most.
          </p>
          <div className="flex justify-center gap-4 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <Link to="/claim">
              <Button size="lg" className="text-lg px-8">
                <FileText className="mr-2 w-5 h-5" />
                Start a Claim
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-lg px-8">
              <Phone className="mr-2 w-5 h-5" />
              Contact Support
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          <Card className="p-6 bg-card/80 backdrop-blur border-primary/20 shadow-lg hover:shadow-glow transition-all animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">AI-Powered Processing</h3>
            <p className="text-muted-foreground">
              Our intelligent system processes your claim in real-time, guiding you through every step.
            </p>
          </Card>

          <Card className="p-6 bg-card/80 backdrop-blur border-primary/20 shadow-lg hover:shadow-glow transition-all animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Instant Coverage Check</h3>
            <p className="text-muted-foreground">
              Know immediately if your claim is covered and what services are available to you.
            </p>
          </Card>

          <Card className="p-6 bg-card/80 backdrop-blur border-primary/20 shadow-lg hover:shadow-glow transition-all animate-fade-in" style={{ animationDelay: "0.5s" }}>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Phone className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">24/7 Support</h3>
            <p className="text-muted-foreground">
              Get help anytime, anywhere. Our AI assistant is always ready to help you file your claim.
            </p>
          </Card>
        </div>

        {/* Call to Action */}
        <Card className="mt-16 p-12 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30 text-center animate-fade-in" style={{ animationDelay: "0.6s" }}>
          <h3 className="text-3xl font-bold mb-4">Need Help Right Now?</h3>
          <p className="text-lg text-muted-foreground mb-6">
            Don't wait. Start your claim process now and get back on the road faster.
          </p>
          <Link to="/claim">
            <Button size="lg" className="text-lg px-12">
              File Your Claim Now
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
};

export default Index;
