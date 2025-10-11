// Client-side storage layer using IndexedDB
// This provides a MongoDB-like API for the MVP

export interface Department {
  id: string;
  name: string;
  ticketTypes: TicketType[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketType {
  id: string;
  name: string;
  defaultWD: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Ticket {
  id: string;
  department: string;
  ticketType: string;
  clientName: string;
  workingDays: number;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Open" | "In Progress" | "Resolved" | "Rejected";
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  dueDate: Date;
}

export interface TicketHistory {
  id: string;
  ticketId: string;
  changes: {
    field: string;
    oldValue: string | number | Date | null | undefined;
    newValue: string | number | Date | null | undefined;
  }[];
  changedBy?: string;
  changedAt: Date;
  reason?: string;
}

class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private dbName = "TicketingSystem";
  private version = 2;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log("Database initialized successfully");
        console.log("Object stores:", Array.from(this.db.objectStoreNames));
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log("Database upgrade needed, creating object stores");

        // Delete existing stores if they exist (for clean upgrade)
        if (db.objectStoreNames.contains("departments")) {
          db.deleteObjectStore("departments");
        }
        if (db.objectStoreNames.contains("tickets")) {
          db.deleteObjectStore("tickets");
        }
        if (db.objectStoreNames.contains("ticketHistory")) {
          db.deleteObjectStore("ticketHistory");
        }

        // Create departments store
        const deptStore = db.createObjectStore("departments", { keyPath: "id" });
        deptStore.createIndex("name", "name", { unique: true });

        // Create tickets store
        const ticketStore = db.createObjectStore("tickets", { keyPath: "id" });
        ticketStore.createIndex("department", "department");
        ticketStore.createIndex("status", "status");
        ticketStore.createIndex("priority", "priority");
        ticketStore.createIndex("createdAt", "createdAt");
        ticketStore.createIndex("dueDate", "dueDate");

        // Create ticket history store
        const historyStore = db.createObjectStore("ticketHistory", { keyPath: "id" });
        historyStore.createIndex("ticketId", "ticketId");
        historyStore.createIndex("changedAt", "changedAt");

        console.log("Object stores created successfully");
      };
    });
  }

  private ensureDB(): IDBDatabase {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }
    return this.db;
  }

  // Department operations
  async createDepartment(department: Omit<Department, "id" | "createdAt" | "updatedAt">): Promise<Department> {
    const db = this.ensureDB();
    const now = new Date();
    const newDept: Department = {
      ...department,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readwrite");
      const store = transaction.objectStore("departments");
      const request = store.add(newDept);

      request.onsuccess = () => resolve(newDept);
      request.onerror = () => reject(request.error);
    });
  }

  async getDepartments(): Promise<Department[]> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readonly");
      const store = transaction.objectStore("departments");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getDepartment(id: string): Promise<Department | null> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readonly");
      const store = transaction.objectStore("departments");
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async updateDepartment(id: string, updates: Partial<Department>): Promise<Department> {
    const db = this.ensureDB();
    const existing = await this.getDepartment(id);
    if (!existing) {
      throw new Error("Department not found");
    }

    const updated: Department = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readwrite");
      const store = transaction.objectStore("departments");
      const request = store.put(updated);

      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteDepartment(id: string): Promise<void> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readwrite");
      const store = transaction.objectStore("departments");
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Ticket Type operations
  async createTicketType(departmentId: string, ticketType: Omit<TicketType, "id" | "createdAt" | "updatedAt">): Promise<TicketType> {
    const db = this.ensureDB();
    const department = await this.getDepartment(departmentId);
    if (!department) {
      throw new Error("Department not found");
    }

    const now = new Date();
    const newTicketType: TicketType = {
      ...ticketType,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    };

    const updatedDepartment: Department = {
      ...department,
      ticketTypes: [...department.ticketTypes, newTicketType],
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readwrite");
      const store = transaction.objectStore("departments");
      const request = store.put(updatedDepartment);

      request.onsuccess = () => resolve(newTicketType);
      request.onerror = () => reject(request.error);
    });
  }

  async updateTicketType(departmentId: string, ticketTypeId: string, updates: Partial<TicketType>): Promise<TicketType> {
    const db = this.ensureDB();
    const department = await this.getDepartment(departmentId);
    if (!department) {
      throw new Error("Department not found");
    }

    const ticketTypeIndex = department.ticketTypes.findIndex((t) => t.id === ticketTypeId);
    if (ticketTypeIndex === -1) {
      throw new Error("Ticket type not found");
    }

    const updatedTicketType: TicketType = {
      ...department.ticketTypes[ticketTypeIndex],
      ...updates,
      updatedAt: new Date(),
    };

    const updatedDepartment: Department = {
      ...department,
      ticketTypes: [...department.ticketTypes.slice(0, ticketTypeIndex), updatedTicketType, ...department.ticketTypes.slice(ticketTypeIndex + 1)],
      updatedAt: new Date(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readwrite");
      const store = transaction.objectStore("departments");
      const request = store.put(updatedDepartment);

      request.onsuccess = () => resolve(updatedTicketType);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTicketType(departmentId: string, ticketTypeId: string): Promise<void> {
    const db = this.ensureDB();
    const department = await this.getDepartment(departmentId);
    if (!department) {
      throw new Error("Department not found");
    }

    const updatedDepartment: Department = {
      ...department,
      ticketTypes: department.ticketTypes.filter((t) => t.id !== ticketTypeId),
      updatedAt: new Date(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readwrite");
      const store = transaction.objectStore("departments");
      const request = store.put(updatedDepartment);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Ticket operations
  async createTicket(ticket: Omit<Ticket, "id" | "createdAt" | "updatedAt" | "dueDate">): Promise<Ticket> {
    const db = this.ensureDB();
    const now = new Date();
    const dueDate = this.calculateDueDate(now, ticket.workingDays);

    const newTicket: Ticket = {
      ...ticket,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
      dueDate,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets"], "readwrite");
      const store = transaction.objectStore("tickets");
      const request = store.add(newTicket);

      request.onsuccess = () => resolve(newTicket);
      request.onerror = () => reject(request.error);
    });
  }

  async getTickets(filters?: { department?: string; status?: string; priority?: string; search?: string }): Promise<Ticket[]> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets"], "readonly");
      const store = transaction.objectStore("tickets");
      const request = store.getAll();

      request.onsuccess = () => {
        let tickets = request.result;

        // Apply filters
        if (filters) {
          if (filters.department) {
            tickets = tickets.filter((t: Ticket) => t.department === filters.department);
          }
          if (filters.status) {
            tickets = tickets.filter((t: Ticket) => t.status === filters.status);
          }
          if (filters.priority) {
            tickets = tickets.filter((t: Ticket) => t.priority === filters.priority);
          }
          if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            tickets = tickets.filter((t: Ticket) => t.clientName.toLowerCase().includes(searchLower) || t.id.toLowerCase().includes(searchLower) || t.ticketType.toLowerCase().includes(searchLower));
          }
        }

        // Sort by creation date (newest first)
        tickets.sort((a: Ticket, b: Ticket) => b.createdAt.getTime() - a.createdAt.getTime());
        resolve(tickets);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getTicket(id: string): Promise<Ticket | null> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets"], "readonly");
      const store = transaction.objectStore("tickets");
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket> {
    console.log("updateTicket called with:", { id, updates });

    const db = this.ensureDB();
    const existing = await this.getTicket(id);
    if (!existing) {
      console.error("Ticket not found:", id);
      throw new Error("Ticket not found");
    }

    console.log("Existing ticket:", existing);

    // Track changes for history
    const changes: { field: string; oldValue: string | number | Date | null | undefined; newValue: string | number | Date | null | undefined }[] = [];
    Object.keys(updates).forEach((key) => {
      const field = key as keyof Ticket;
      if (updates[field] !== undefined && existing[field] !== updates[field]) {
        changes.push({
          field,
          oldValue: existing[field],
          newValue: updates[field],
        });
      }
    });

    const updated: Ticket = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    // Recalculate due date if working days changed
    if (updates.workingDays !== undefined) {
      updated.dueDate = this.calculateDueDate(updated.createdAt, updated.workingDays);
    }

    console.log("Updated ticket:", updated);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets", "ticketHistory"], "readwrite");
      const ticketStore = transaction.objectStore("tickets");
      const historyStore = transaction.objectStore("ticketHistory");

      // Update the ticket
      const ticketRequest = ticketStore.put(updated);

      ticketRequest.onsuccess = () => {
        console.log("Ticket updated successfully in database");
        // Add history entry if there are changes
        if (changes.length > 0) {
          const historyEntry: TicketHistory = {
            id: this.generateId(),
            ticketId: id,
            changes,
            changedAt: new Date(),
          };
          historyStore.add(historyEntry);
          console.log("History entry added:", historyEntry);
        }
        resolve(updated);
      };

      ticketRequest.onerror = () => {
        console.error("Database error:", ticketRequest.error);
        reject(ticketRequest.error);
      };
    });
  }

  async deleteTicket(id: string): Promise<void> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets"], "readwrite");
      const store = transaction.objectStore("tickets");
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Ticket history operations
  async getTicketHistory(ticketId: string): Promise<TicketHistory[]> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["ticketHistory"], "readonly");
      const store = transaction.objectStore("ticketHistory");
      const index = store.index("ticketId");
      const request = index.getAll(ticketId);

      request.onsuccess = () => {
        const history = request.result;
        // Sort by date (newest first)
        history.sort((a: TicketHistory, b: TicketHistory) => b.changedAt.getTime() - a.changedAt.getTime());
        resolve(history);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllTicketHistory(): Promise<TicketHistory[]> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["ticketHistory"], "readonly");
      const store = transaction.objectStore("ticketHistory");
      const request = store.getAll();

      request.onsuccess = () => {
        const history = request.result;
        // Sort by date (newest first)
        history.sort((a: TicketHistory, b: TicketHistory) => b.changedAt.getTime() - a.changedAt.getTime());
        resolve(history);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Utility methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private calculateDueDate(startDate: Date, workingDays: number): Date {
    const dueDate = new Date(startDate);
    let daysAdded = 0;

    while (daysAdded < workingDays) {
      dueDate.setDate(dueDate.getDate() + 1);
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (dueDate.getDay() !== 0 && dueDate.getDay() !== 6) {
        daysAdded++;
      }
    }

    return dueDate;
  }

  // Seed data from JSON
  async seedDepartments(departmentsData: { name: string; ticketTypes: { name: string; defaultWD: number; description?: string }[] }[]): Promise<void> {
    const existingDepartments = await this.getDepartments();
    if (existingDepartments.length > 0) {
      console.log("Departments already exist, skipping seed");
      return;
    }

    for (const deptData of departmentsData) {
      const ticketTypes: TicketType[] = deptData.ticketTypes.map((type: { name: string; defaultWD: number; description?: string }) => ({
        id: this.generateId(),
        name: type.name,
        defaultWD: type.defaultWD,
        description: type.description || "",
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await this.createDepartment({
        name: deptData.name,
        ticketTypes,
      });
    }

    console.log(`Seeded ${departmentsData.length} departments`);
  }

  // Seed sample tickets for demonstration
  async seedSampleTickets(): Promise<void> {
    const existingTickets = await this.getTickets();
    if (existingTickets.length > 0) {
      console.log("Tickets already exist, skipping sample seed");
      return;
    }

    const departments = await this.getDepartments();
    if (departments.length === 0) {
      console.log("No departments found, cannot seed sample tickets");
      return;
    }

    const sampleTickets = [
      {
        department: "Collection",
        ticketType: "Postpone Installement",
        clientName: "Ahmed Mohamed",
        workingDays: 8,
        priority: "High" as const,
        status: "Open" as const,
        description: "Client requested to postpone next installment due to financial difficulties",
      },
      {
        department: "Sports",
        ticketType: "Club",
        clientName: "Sarah Johnson",
        workingDays: 6,
        priority: "Medium" as const,
        status: "In Progress" as const,
        description: "Membership process for new club member",
      },
      {
        department: "Customer Care",
        ticketType: "General Info",
        clientName: "Mohamed Ali",
        workingDays: 2,
        priority: "Low" as const,
        status: "Resolved" as const,
        description: "General inquiry about payment schedule",
      },
      {
        department: "Contracts",
        ticketType: "Contract Signing",
        clientName: "Fatima Hassan",
        workingDays: 5,
        priority: "High" as const,
        status: "Open" as const,
        description: "Unit contract signing appointment needed",
      },
      {
        department: "TCR",
        ticketType: "WORK PERMIT",
        clientName: "Omar Khaled",
        workingDays: 1,
        priority: "Critical" as const,
        status: "In Progress" as const,
        description: "Urgent work permit for renovation",
      },
      {
        department: "Security",
        ticketType: "Access permission",
        clientName: "Layla Ahmed",
        workingDays: 2,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "Request for visitor access permission",
      },
      {
        department: "FM (Facilities Management)",
        ticketType: "Maintenance Works",
        clientName: "Hassan Ibrahim",
        workingDays: 3,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "AC maintenance request for unit 205",
      },
      {
        department: "HO (Handover)",
        ticketType: "Setting an appointment",
        clientName: "Nour El-Din",
        workingDays: 2,
        priority: "High" as const,
        status: "In Progress" as const,
        description: "Schedule handover appointment for new unit",
      },
      {
        department: "CM (Community Management)",
        ticketType: "Security Issues",
        clientName: "Mariam Farouk",
        workingDays: 1,
        priority: "Critical" as const,
        status: "Open" as const,
        description: "Security breach reported in building A",
      },
      {
        department: "Resale & Rental",
        ticketType: "Existing client renting unit",
        clientName: "Karim Mostafa",
        workingDays: 5,
        priority: "Medium" as const,
        status: "Resolved" as const,
        description: "Rental agreement processing for existing client",
      },
      {
        department: "Collection",
        ticketType: "General Inquiry",
        clientName: "Dina Samir",
        workingDays: 2,
        priority: "Low" as const,
        status: "Open" as const,
        description: "Inquiry about payment methods and schedules",
      },
      {
        department: "Sports",
        ticketType: "Gym",
        clientName: "Youssef Nabil",
        workingDays: 3,
        priority: "Medium" as const,
        status: "In Progress" as const,
        description: "Gym membership renewal and facility access",
      },
    ];

    for (const ticketData of sampleTickets) {
      await this.createTicket(ticketData);
    }

    console.log(`Seeded ${sampleTickets.length} sample tickets`);
  }

  // Clear all data (for testing)
  async clearAll(): Promise<void> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments", "tickets", "ticketHistory"], "readwrite");

      transaction.objectStore("departments").clear();
      transaction.objectStore("tickets").clear();
      transaction.objectStore("ticketHistory").clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async resetDatabase(): Promise<void> {
    // Close existing connection
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    // Delete the entire database
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(this.dbName);
      deleteRequest.onsuccess = () => {
        console.log("Database deleted successfully");
        resolve();
      };
      deleteRequest.onerror = () => reject(deleteRequest.error);
    });
  }
}

// Export singleton instance
export const storage = new IndexedDBStorage();
