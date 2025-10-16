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
  subCategory?: string;
  priority: string;
  workflowId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Ticket {
  id: string;
  department: string;
  ticketType: string;
  subCategory?: string;
  sla?: {
    value: number;
    unit: "hours" | "days";
  };
  clientName: string;
  unitId?: string;
  workingDays: number;
  priority: string;
  status: "Open" | "In Progress" | "Resolved" | "Rejected" | "Overdue";
  description?: string;
  ticketOwner: string;
  currentWorkflowStep?: number;
  workflowId?: string;
  createdAt: Date;
  updatedAt: Date;
  dueDate: Date;
}

export interface WorkflowStep {
  id: string;
  departmentId: string;
  departmentName: string;
  stepNumber: number;
  isRequired: boolean;
  estimatedDays?: number;
  slaUnit?: "hours" | "days";
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowResolution {
  id: string;
  ticketId: string;
  stepNumber: number;
  fromDepartment: string;
  toDepartment?: string;
  resolvedBy: string;
  resolutionText: string;
  attachments?: string[];
  resolvedAt: Date;
  isFinalResolution: boolean;
}

export interface TicketHistory {
  id: string;
  ticketId: string;
  changes: {
    field: string;
    oldValue: string | number | Date | { value: number; unit: "hours" | "days" } | null | undefined;
    newValue: string | number | Date | { value: number; unit: "hours" | "days" } | null | undefined;
  }[];
  changedBy?: string;
  changedAt: Date;
  reason?: string;
}

class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private dbName = "TicketingSystem";
  private version = 6;
  private idCounter = 0;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private static instance: IndexedDBStorage;

  async init(): Promise<void> {
    if (this.isInitialized) {
      return Promise.resolve();
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve) => {
      // Check if we're in a browser environment
      if (typeof window === "undefined" || !window.indexedDB) {
        console.log("IndexedDB not available, using fallback");
        this.isInitialized = true;
        resolve();
        return;
      }

      console.log("Opening IndexedDB:", this.dbName, "version:", this.version);

      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.error("IndexedDB initialization timeout, using fallback");
        this.isInitialized = true;
        resolve();
      }, 3000);

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        clearTimeout(timeout);
        console.error("IndexedDB error:", request.error);
        this.isInitialized = true;
        resolve(); // Don't reject, just continue without IndexedDB
      };

      request.onsuccess = () => {
        clearTimeout(timeout);
        console.log("IndexedDB opened successfully");
        this.db = request.result;
        this.isInitialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        console.log("IndexedDB upgrade needed");
        const db = (event.target as IDBOpenDBRequest).result;

        try {
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

          // Create workflows store
          const workflowStore = db.createObjectStore("workflows", { keyPath: "id" });
          workflowStore.createIndex("name", "name");
          workflowStore.createIndex("isDefault", "isDefault");

          // Create workflow resolutions store
          const resolutionStore = db.createObjectStore("workflowResolutions", { keyPath: "id" });
          resolutionStore.createIndex("ticketId", "ticketId");
          resolutionStore.createIndex("resolvedAt", "resolvedAt");

          console.log("Object stores created successfully");
        } catch (error) {
          console.error("Error during upgrade:", error);
          this.isInitialized = true;
          resolve(); // Don't reject, just continue without IndexedDB
        }
      };
    });

    return this.initPromise;
  }

  private ensureDB(): IDBDatabase | null {
    if (!this.isInitialized) {
      console.log("Database not initialized yet");
      return null;
    }
    if (!this.db) {
      console.log("IndexedDB not available, returning null");
      return null;
    }
    return this.db;
  }

  // Department operations
  async createDepartment(department: Omit<Department, "id" | "createdAt" | "updatedAt">): Promise<Department> {
    await this.init();
    const db = this.ensureDB();
    if (!db) {
      throw new Error("IndexedDB not available");
    }
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
      request.onerror = () => reject(request.error!);
    });
  }

  async getDepartments(): Promise<Department[]> {
    await this.init();
    const db = this.ensureDB();
    if (!db) {
      return [];
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readonly");
      const store = transaction.objectStore("departments");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error!);
    });
  }

  async getDepartment(id: string): Promise<Department | null> {
    const db = this.ensureDB();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readonly");
      const store = transaction.objectStore("departments");
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error!);
    });
  }

  async updateDepartment(id: string, updates: Partial<Department>): Promise<Department> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
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
      request.onerror = () => reject(request.error!);
    });
  }

  async deleteDepartment(id: string): Promise<void> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readwrite");
      const store = transaction.objectStore("departments");
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error!);
    });
  }

  // Ticket Type operations
  async createTicketType(departmentId: string, ticketType: Omit<TicketType, "id" | "createdAt" | "updatedAt">): Promise<TicketType> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
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
      request.onerror = () => reject(request.error!);
    });
  }

  async updateTicketType(departmentId: string, ticketTypeId: string, updates: Partial<TicketType>): Promise<TicketType> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
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
      request.onerror = () => reject(request.error!);
    });
  }

  async deleteTicketType(departmentId: string, ticketTypeId: string): Promise<void> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
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
      request.onerror = () => reject(request.error!);
    });
  }

  // Ticket operations
  async createTicket(ticket: Omit<Ticket, "id" | "createdAt" | "updatedAt" | "dueDate">): Promise<Ticket> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
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
      request.onerror = () => reject(request.error!);
    });
  }

  async getTickets(filters?: { department?: string; status?: string; priority?: string; search?: string }): Promise<Ticket[]> {
    await this.init();
    const db = this.ensureDB();
    if (!db) {
      return [];
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets"], "readwrite");
      const store = transaction.objectStore("tickets");
      const request = store.getAll();

      request.onsuccess = async () => {
        let tickets = request.result;

        // Update tickets to "Overdue" status if they're past due date
        const now = new Date();
        const ticketsToUpdate: Ticket[] = [];

        for (const ticket of tickets) {
          if (ticket.dueDate < now && ticket.status !== "Resolved" && ticket.status !== "Rejected" && ticket.status !== "Overdue") {
            const updatedTicket = { ...ticket, status: "Overdue" as const, updatedAt: now };
            ticketsToUpdate.push(updatedTicket);
          }
        }

        // Update tickets that need status change
        if (ticketsToUpdate.length > 0) {
          for (const ticket of ticketsToUpdate) {
            await new Promise<void>((resolveUpdate, rejectUpdate) => {
              const updateRequest = store.put(ticket);
              updateRequest.onsuccess = () => resolveUpdate();
              updateRequest.onerror = () => rejectUpdate(updateRequest.error);
            });
          }

          // Update the tickets array with the new statuses
          tickets = tickets.map((ticket) => {
            const updated = ticketsToUpdate.find((ut) => ut.id === ticket.id);
            return updated || ticket;
          });
        }

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
      request.onerror = () => reject(request.error!);
    });
  }

  async getTicket(id: string): Promise<Ticket | null> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets"], "readonly");
      const store = transaction.objectStore("tickets");
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error!);
    });
  }

  async updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    const existing = await this.getTicket(id);
    if (!existing) {
      console.error("Ticket not found:", id);
      throw new Error("Ticket not found");
    }

    // Track changes for history
    const changes: { field: string; oldValue: string | number | Date | { value: number; unit: "hours" | "days" } | null | undefined; newValue: string | number | Date | { value: number; unit: "hours" | "days" } | null | undefined }[] = [];
    Object.keys(updates).forEach((key) => {
      const field = key as keyof Ticket;
      if (updates[field] !== undefined && existing[field] !== updates[field]) {
        changes.push({
          field,
          oldValue: existing[field] as string | number | Date | { value: number; unit: "hours" | "days" } | null | undefined,
          newValue: updates[field] as string | number | Date | { value: number; unit: "hours" | "days" } | null | undefined,
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

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets", "ticketHistory"], "readwrite");
      const ticketStore = transaction.objectStore("tickets");
      const historyStore = transaction.objectStore("ticketHistory");

      // Update the ticket
      const ticketRequest = ticketStore.put(updated);

      ticketRequest.onsuccess = () => {
        // Add history entry if there are changes
        if (changes.length > 0) {
          const historyEntry: TicketHistory = {
            id: this.generateId(),
            ticketId: id,
            changes,
            changedAt: new Date(),
          };
          historyStore.add(historyEntry);
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
    if (!db) throw new Error("Database not available");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets"], "readwrite");
      const store = transaction.objectStore("tickets");
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error!);
    });
  }

  // Ticket history operations
  async getTicketHistory(ticketId: string): Promise<TicketHistory[]> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    if (!db) throw new Error("Database not available");
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
      request.onerror = () => reject(request.error!);
    });
  }

  async getAllTicketHistory(): Promise<TicketHistory[]> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    if (!db) throw new Error("Database not available");
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
      request.onerror = () => reject(request.error!);
    });
  }

  // Utility methods
  private generateId(): string {
    // Use a simple counter for server-side consistency
    this.idCounter += 1;
    return `id_${this.idCounter}`;
  }

  // Singleton pattern to ensure consistent state
  static getInstance(): IndexedDBStorage {
    if (!IndexedDBStorage.instance) {
      IndexedDBStorage.instance = new IndexedDBStorage();
    }
    return IndexedDBStorage.instance;
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
  async seedDepartments(departmentsData: { name: string; ticketTypes: { name: string; defaultWD: number; description?: string; subCategory?: string; priority: string }[] }[]): Promise<void> {
    const existingDepartments = await this.getDepartments();
    if (existingDepartments.length > 0) {
      return;
    }

    for (const deptData of departmentsData) {
      const ticketTypes: TicketType[] = deptData.ticketTypes.map((type: { name: string; defaultWD: number; description?: string; subCategory?: string; priority: string }) => {
        return {
          id: this.generateId(),
          name: type.name,
          defaultWD: type.defaultWD,
          description: type.description || "",
          subCategory: type.subCategory || "",
          priority: type.priority,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      await this.createDepartment({
        name: deptData.name,
        ticketTypes,
      });
    }
  }

  // Seed sample tickets for demonstration
  async seedSampleTickets(): Promise<void> {
    const existingTickets = await this.getTickets();
    if (existingTickets.length > 0) {
      return;
    }

    const departments = await this.getDepartments();
    if (departments.length === 0) {
      return;
    }

    const sampleTickets = [
      {
        department: "Collection",
        ticketType: "Postpone Installement",
        clientName: "Ahmed Mohamed",
        ticketOwner: "Front Desk",
        workingDays: 8,
        priority: "High" as const,
        status: "Open" as const,
        description: "Client requested to postpone next installment due to financial difficulties",
      },
      {
        department: "Sports",
        ticketType: "Club",
        clientName: "Sarah Johnson",
        ticketOwner: "Front Desk",
        workingDays: 6,
        priority: "Medium" as const,
        status: "In Progress" as const,
        description: "Membership process for new club member",
      },
      {
        department: "Customer Care",
        ticketType: "General Info",
        clientName: "Mohamed Ali",
        ticketOwner: "Front Desk",
        workingDays: 2,
        priority: "Low" as const,
        status: "Resolved" as const,
        description: "General inquiry about payment schedule",
      },
      {
        department: "Contracts",
        ticketType: "Contract Signing",
        clientName: "Fatima Hassan",
        ticketOwner: "Front Desk",
        workingDays: 5,
        priority: "High" as const,
        status: "Open" as const,
        description: "Unit contract signing appointment needed",
      },
      {
        department: "TCR",
        ticketType: "WORK PERMIT",
        clientName: "Omar Khaled",
        ticketOwner: "Front Desk",
        workingDays: 1,
        priority: "Critical" as const,
        status: "In Progress" as const,
        description: "Urgent work permit for renovation",
      },
      {
        department: "Security",
        ticketType: "Access permission",
        clientName: "Layla Ahmed",
        ticketOwner: "Front Desk",
        workingDays: 2,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "Request for visitor access permission",
      },
      {
        department: "FM (Facilities Management)",
        ticketType: "Maintenance Works",
        clientName: "Hassan Ibrahim",
        ticketOwner: "Front Desk",
        workingDays: 3,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "AC maintenance request for unit 205",
      },
      {
        department: "HO (Handover)",
        ticketType: "Setting an appointment",
        clientName: "Nour El-Din",
        ticketOwner: "Front Desk",
        workingDays: 2,
        priority: "High" as const,
        status: "In Progress" as const,
        description: "Schedule handover appointment for new unit",
      },
      {
        department: "CM (Community Management)",
        ticketType: "Security Issues",
        clientName: "Mariam Farouk",
        ticketOwner: "Front Desk",
        workingDays: 1,
        priority: "Critical" as const,
        status: "Open" as const,
        description: "Security breach reported in building A",
      },
      {
        department: "Resale & Rental",
        ticketType: "Existing client renting unit",
        clientName: "Karim Mostafa",
        ticketOwner: "Front Desk",
        workingDays: 5,
        priority: "Medium" as const,
        status: "Resolved" as const,
        description: "Rental agreement processing for existing client",
      },
      {
        department: "Collection",
        ticketType: "General Inquiry",
        clientName: "Dina Samir",
        ticketOwner: "Front Desk",
        workingDays: 2,
        priority: "Low" as const,
        status: "Open" as const,
        description: "Inquiry about payment methods and schedules",
      },
      {
        department: "Sports",
        ticketType: "Gym",
        clientName: "Youssef Nabil",
        ticketOwner: "Front Desk",
        workingDays: 3,
        priority: "Medium" as const,
        status: "In Progress" as const,
        description: "Gym membership renewal and facility access",
      },
    ];

    for (const ticketData of sampleTickets) {
      await this.createTicket(ticketData);
    }
  }

  // Clear all data (for testing)
  async clearAll(): Promise<void> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments", "tickets", "ticketHistory", "workflows", "workflowResolutions"], "readwrite");

      transaction.objectStore("departments").clear();
      transaction.objectStore("tickets").clear();
      transaction.objectStore("ticketHistory").clear();
      transaction.objectStore("workflows").clear();
      transaction.objectStore("workflowResolutions").clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Workflow Management
  async createWorkflow(workflow: Omit<Workflow, "id" | "createdAt" | "updatedAt">): Promise<Workflow> {
    await this.init();
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    const now = new Date();
    const newWorkflow: Workflow = {
      ...workflow,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["workflows"], "readwrite");
      const store = transaction.objectStore("workflows");
      const request = store.add(newWorkflow);

      request.onsuccess = () => resolve(newWorkflow);
      request.onerror = () => reject(request.error!);
    });
  }

  async getWorkflows(): Promise<Workflow[]> {
    await this.init();
    const db = this.ensureDB();
    if (!db) {
      return [];
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["workflows"], "readonly");
      const store = transaction.objectStore("workflows");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error!);
    });
  }

  async getWorkflow(id: string): Promise<Workflow | null> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["workflows"], "readonly");
      const store = transaction.objectStore("workflows");
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error!);
    });
  }

  async getDefaultWorkflow(): Promise<Workflow | null> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["workflows"], "readonly");
      const store = transaction.objectStore("workflows");
      const request = store.getAll();

      request.onsuccess = () => {
        const workflows = request.result || [];
        const defaultWorkflow = workflows.find((w: Workflow) => w.isDefault);
        resolve(defaultWorkflow || null);
      };
      request.onerror = () => reject(request.error!);
    });
  }

  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    const existing = await this.getWorkflow(id);
    if (!existing) {
      throw new Error("Workflow not found");
    }

    const updated: Workflow = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["workflows"], "readwrite");
      const store = transaction.objectStore("workflows");
      const request = store.put(updated);

      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(request.error!);
    });
  }

  async deleteWorkflow(id: string): Promise<void> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["workflows"], "readwrite");
      const store = transaction.objectStore("workflows");
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error!);
    });
  }

  // Workflow Resolution Management
  async createWorkflowResolution(resolution: Omit<WorkflowResolution, "id" | "resolvedAt">): Promise<WorkflowResolution> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    const now = new Date();
    const newResolution: WorkflowResolution = {
      ...resolution,
      id: this.generateId(),
      resolvedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["workflowResolutions"], "readwrite");
      const store = transaction.objectStore("workflowResolutions");
      const request = store.add(newResolution);

      request.onsuccess = () => resolve(newResolution);
      request.onerror = () => reject(request.error!);
    });
  }

  async getWorkflowResolutions(ticketId: string): Promise<WorkflowResolution[]> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    if (!db) throw new Error("Database not available");
    if (!db) throw new Error("Database not available");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["workflowResolutions"], "readonly");
      const store = transaction.objectStore("workflowResolutions");
      const index = store.index("ticketId");
      const request = index.getAll(ticketId);

      request.onsuccess = () => {
        const resolutions = request.result;
        // Sort by resolution date (newest first)
        resolutions.sort((a: WorkflowResolution, b: WorkflowResolution) => b.resolvedAt.getTime() - a.resolvedAt.getTime());
        resolve(resolutions);
      };
      request.onerror = () => reject(request.error!);
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
        resolve();
      };
      deleteRequest.onerror = () => reject(deleteRequest.error);
    });
  }
}

// Export singleton instance
export const storage = IndexedDBStorage.getInstance();
