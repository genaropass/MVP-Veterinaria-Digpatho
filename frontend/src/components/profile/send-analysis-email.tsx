"use client";

//import { StudyData } from "@/context/profile-context";
//import { StudyType } from "./study-utils";
// import { HOST } from "@/utils/constants";
// import { useProfile } from "@/context/profile-context";

/* Ejemplo de funcion de fetch en caso de que el backend provea endpoint: 
interface SendAnalysisEmailProps {
  study: StudyData;
  studyType: StudyType;
}
    const sendEmail = async () => {
      try {
        await fetch(`${HOST}/api/send-analysis-email`,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: session?.user?.email,
            studyType,
            results: Array.from(study.results.entries()),
          }),
        });

      } catch (error) {
        console.error(error);
      }
    } */
/*Este componente solo muestra un mensaje de confirmación. 
El envío real del email debe hacerse desde el backend.
 */
export default function SendAnalysisEmail() {

    
  return (
    <div className="p-4 bg-green-100 text-green-800 rounded">
      El informe ha sido enviado por email.
    </div>
  );
}

