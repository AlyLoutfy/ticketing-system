export interface SLA {
  value: number;
  unit: "hours" | "days";
}

export function formatSLA(sla: SLA): string {
  if (sla.unit === "hours") {
    return `${sla.value}h`;
  } else {
    return `${sla.value}WD`;
  }
}

export function parseSLA(slaString: string | undefined | null): SLA {
  // Handle null, undefined, or empty string
  if (!slaString || typeof slaString !== "string") {
    return { value: 5, unit: "days" };
  }

  // Handle legacy string format like "5 Working Days" or "12h"
  if (slaString.includes("h")) {
    const value = parseInt(slaString.replace("h", ""));
    return { value: isNaN(value) ? 5 : value, unit: "hours" };
  } else if (slaString.includes("WD") || slaString.includes("Working Days")) {
    const value = parseInt(slaString.replace("WD", "").replace(" Working Days", ""));
    return { value: isNaN(value) ? 5 : value, unit: "days" };
  } else {
    // Default to days if format is unclear
    const value = parseInt(slaString) || 5;
    return { value, unit: "days" };
  }
}

export function calculateDueDate(sla: SLA, startDate: Date = new Date()): Date {
  const dueDate = new Date(startDate);

  if (sla.unit === "hours") {
    dueDate.setHours(dueDate.getHours() + sla.value);
  } else {
    // For days, we need to calculate working days
    let workingDaysAdded = 0;
    const currentDate = new Date(startDate);

    while (workingDaysAdded < sla.value) {
      currentDate.setDate(currentDate.getDate() + 1);
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        workingDaysAdded++;
      }
    }

    dueDate.setTime(currentDate.getTime());
  }

  return dueDate;
}
