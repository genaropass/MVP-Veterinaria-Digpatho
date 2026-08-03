"use client"
import Link from "next/link";
import { Button } from "@/components/ui/button";

const ErrorPage = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            <h1 className="text-4xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <p className="text-lg text-gray-700 mb-8">
                We encountered an unexpected error. Please try again later or contact support.
            </p>
            <Button asChild variant="outline" className="mb-4">
                <Link href="/">Go to Home</Link>
            </Button>
            <Button asChild variant="outline" className="mb-4">
                <Link href="/auth/sign-in">Sign In</Link>
            </Button>
            <Button asChild variant="outline">
                <Link href="/auth/sign-up">Sign Up</Link>
            </Button>
        </div>
    );
};

export default ErrorPage;
