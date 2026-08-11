import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, ArrowLeft, Search } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
      <div className="absolute top-0 right-0 -z-10">
        <div className="w-72 h-72 bg-gradient-to-bl from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl" />
      </div>
      <div className="absolute bottom-0 left-0 -z-10">
        <div className="w-96 h-96 bg-gradient-to-tr from-indigo-400/20 to-purple-600/20 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 py-8 flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-lg border-2 border-dashed border-blue-200 bg-white/80 backdrop-blur-sm shadow-2xl">
          <CardContent className="flex flex-col items-center justify-center py-16 px-8 text-center">
            {/* 404 Icon */}
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-8 shadow-lg">
              <Search className="w-12 h-12 text-blue-600" />
            </div>

            {/* 404 Number */}
            <h1 className="text-6xl sm:text-8xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-4">
              404
            </h1>

            {/* Title */}
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              Page Not Found
            </h2>

            {/* Description */}
            <p className="text-gray-600 text-base sm:text-lg mb-8 max-w-md leading-relaxed">
              The page you're looking for doesn't exist or has been moved.
              Let's get you back on track.
            </p>

            {/* Error Path */}
            <div className="bg-gray-50 rounded-lg px-4 py-3 mb-8 w-full max-w-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">
                Requested Path
              </p>
              <p className="text-sm font-mono text-gray-700 break-all">
                {location.pathname}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
              <Button
                onClick={() => navigate(-1)}
                variant="outline"
                className="flex-1 bg-white/80 backdrop-blur-sm border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-lg"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
              <Button
                onClick={() => navigate('/')}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
              >
                <Home className="w-4 h-4 mr-2" />
                Home
              </Button>
            </div>

            {/* Additional Help */}
            <div className="mt-8 pt-6 border-t border-gray-200 w-full max-w-sm">
              <p className="text-xs text-gray-500">
                Need help? Contact our support team or try searching for what you need.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotFound;
