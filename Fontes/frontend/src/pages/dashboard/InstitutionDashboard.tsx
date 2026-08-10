import { useEffect, useState } from "react";

import { getInstitutionDashboard } from "../../api/services/DashboardService";
import { InstitutionDashboard } from "../../api/types/dashboard/InstitutionDashboard";
import { useAuth } from "../../contexts/AuthContexts";

import "./dashboard.css";

export default function InstitutionDashboardPage() {
  const { user } = useAuth();

  const [dashboard, setDashboard] = useState<InstitutionDashboard | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) {
        return;
      }

      try {
        const data = await getInstitutionDashboard(user.id);

        setDashboard(data);
      } catch (error) {
        console.error("Erro ao carregar dashboard da instituição:", error);
      }
    }

    load();
  }, [user]);

  if (!dashboard) {
    return (
      <div className="page">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Cabeçalho */}
      <div className="dashboard-header">
        <div>
          <h1>Dashboard da Instituição</h1>

          <p>{dashboard.institution.name}</p>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid">
        <div className="card">
          <h2>Pacientes</h2>

          <h1>{dashboard.statistics.totalPatients}</h1>
        </div>

        <div className="card">
          <h2>Tratamentos ativos</h2>

          <h1>{dashboard.statistics.activeTreatments}</h1>
        </div>

        <div className="card">
          <h2>Doses hoje</h2>

          <h1>{dashboard.statistics.todayDoses}</h1>
        </div>
      </div>

      {/* Tratamentos ativos */}
      <div className="card active-treatments-card">
        <div className="section-header">
          <div>
            <h2>Tratamentos ativos</h2>

            <p>Tratamentos atualmente em andamento.</p>
          </div>
        </div>

        {dashboard.activeTreatments.length === 0 ? (
          <p className="empty-message">Nenhum tratamento ativo.</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Paciente</th>

                  <th>Medicamento</th>

                  <th>Intervalo</th>

                  <th>Duração</th>

                  <th>Início</th>
                </tr>
              </thead>

              <tbody>
                {dashboard.activeTreatments.map((treatment) => (
                  <tr key={treatment.id}>
                    <td>{treatment.patientName}</td>

                    <td>{treatment.medication}</td>

                    <td>A cada {treatment.intervalHours} horas</td>

                    <td>{treatment.durationDays} dias</td>

                    <td>
                      {new Date(treatment.startDate).toLocaleDateString(
                        "pt-BR"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
