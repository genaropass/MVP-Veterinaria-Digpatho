// context/PatientContext.tsx
"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { API_TOKEN, HOST } from "@/utils/constants";

type PatientContextType = {
  pacienteId: string | null;
  setPacienteId: (id: string) => void;
  informeId: string | null;
  setInformeId: (id: string | null) => void;
};

const PatientContext = createContext<PatientContextType | undefined>(undefined);


export const PatientProvider = ({ children }: { children: ReactNode }) => {
  const [pacienteId, setPacienteId] = useState<string>("");
  const [informeId, setInformeId] = useState<string | null>(null);

  return (
    <PatientContext.Provider
      value={{ pacienteId, setPacienteId, informeId, setInformeId }}
    >
      {children}
    </PatientContext.Provider>
  );
};

export const usePatient = () => {
  const context = useContext(PatientContext);
  if (!context)
    throw new Error("usePatient must be used within a PatientProvider");
  return context;
};




//FUNCIONA CON EL ID DE PACIENTE
// "use client"
// import { createContext, useContext, useState, ReactNode } from "react";

// type PatientContextType = {
//   pacienteId: string;
//   setPacienteId: (id: string) => void;
// };

// const PatientContext = createContext<PatientContextType | undefined>(undefined);

// export const PatientProvider = ({ children }: { children: ReactNode }) => {
//   const [pacienteId, setPacienteId] = useState("");

//   return (
//     <PatientContext.Provider value={{ pacienteId, setPacienteId}}>
//       {children}
//     </PatientContext.Provider>
//   );
// };

// export const usePatient = () => {
//   const context = useContext(PatientContext);
//   if (!context) throw new Error("usePatient must be used within a PatientProvider");
//   return context;
// };