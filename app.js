(function () {
  "use strict";

  var STORAGE_KEY = "ruang-simpan-v1";
  var monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  var rupiah = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  });
  var state = loadState();
  var transactionDialog = document.getElementById("transaction-dialog");
  var goalDialog = document.getElementById("goal-dialog");
  var transactionForm = document.getElementById("transaction-form");
  var showAllTransactions = false;

  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return emptyState();
      return {
        transactions: Array.isArray(saved.transactions) ? saved.transactions : [],
        goals: Array.isArray(saved.goals) ? saved.goals : [],
        emergencyBalance: finiteNumber(saved.emergencyBalance),
        settings: {
          emergencyPerIncome: finiteNumber(saved.settings && saved.settings.emergencyPerIncome),
          dreamPerIncome: finiteNumber(saved.settings && saved.settings.dreamPerIncome)
        }
      };
    } catch (error) {
      console.error("Tidak dapat membaca data tabungan dari penyimpanan browser.", error);
      return emptyState();
    }
  }

  function emptyState() {
    return {
      transactions: [],
      goals: [],
      emergencyBalance: 0,
      settings: { emergencyPerIncome: 3000, dreamPerIncome: 5000 }
    };
  }

  function finiteNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.error("Tidak dapat menyimpan data tabungan ke penyimpanan browser.", error);
      window.alert("Data belum dapat disimpan di browser ini. Periksa ruang penyimpanan perangkat Anda.");
      return false;
    }
  }

  function formatMoney(amount) {
    return rupiah.format(Math.round(finiteNumber(amount)));
  }

  function dateKey(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
  }

  function transactionDate(value) {
    var parts = String(value || "").split("-").map(Number);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return new Date(0);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDate(value) {
    var date = transactionDate(value);
    if (!date.getTime()) return "Tanggal tidak diketahui";
    return date.getDate() + " " + monthNames[date.getMonth()] + " " + date.getFullYear();
  }

  function localDateInputValue(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" +
      String(date.getDate()).padStart(2, "0");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function goalBalance() {
    return state.goals.reduce(function (total, goal) {
      return total + finiteNumber(goal.savedAmount);
    }, 0);
  }

  function totalIncome() {
    return state.transactions.reduce(function (total, item) {
      return total + (item.type === "income" ? finiteNumber(item.amount) : 0);
    }, 0);
  }

  function totalExpenses() {
    return state.transactions.reduce(function (total, item) {
      return total + (item.type === "expense" ? finiteNumber(item.amount) : 0);
    }, 0);
  }

  function availableBalance() {
    return Math.max(0, totalIncome() - totalExpenses() - state.emergencyBalance - goalBalance());
  }

  function currentMonthTransactions() {
    var currentMonth = dateKey(new Date());
    return state.transactions.filter(function (item) {
      return dateKey(transactionDate(item.date)) === currentMonth;
    });
  }

  function renderSummary() {
    var monthItems = currentMonthTransactions();
    var monthIncome = monthItems.reduce(function (total, item) {
      return total + (item.type === "income" ? finiteNumber(item.amount) : 0);
    }, 0);
    var monthExpenses = monthItems.reduce(function (total, item) {
      return total + (item.type === "expense" ? finiteNumber(item.amount) : 0);
    }, 0);
    document.getElementById("available-balance").textContent = formatMoney(availableBalance());
    document.getElementById("monthly-income").textContent = formatMoney(monthIncome);
    document.getElementById("monthly-expenses").textContent = formatMoney(monthExpenses);
    document.getElementById("emergency-balance").textContent = formatMoney(state.emergencyBalance);
  }

  function renderChart() {
    var months = [];
    var now = new Date();
    for (var offset = 5; offset >= 0; offset -= 1) {
      months.push(new Date(now.getFullYear(), now.getMonth() - offset, 1));
    }
    var monthTotals = months.map(function (month) {
      var key = dateKey(month);
      return state.transactions.reduce(function (totals, item) {
        if (dateKey(transactionDate(item.date)) !== key) return totals;
        if (item.type === "income") totals.income += finiteNumber(item.amount);
        else totals.expense += finiteNumber(item.amount);
        return totals;
      }, { income: 0, expense: 0 });
    });
    var maximum = Math.max.apply(null, monthTotals.map(function (item) {
      return Math.max(item.income, item.expense);
    }).concat([1]));
    var average = monthTotals.reduce(function (total, item) {
      return total + item.expense;
    }, 0) / monthTotals.length;
    document.getElementById("monthly-average").textContent = formatMoney(average);
    document.getElementById("cashflow-chart").innerHTML = monthTotals.map(function (totals, index) {
      var month = months[index];
      var incomeHeight = Math.max(3, totals.income / maximum * 100);
      var expenseHeight = Math.max(3, totals.expense / maximum * 100);
      return '<div class="chart-month" title="' + monthNames[month.getMonth()] + ': pemasukan ' +
        escapeHtml(formatMoney(totals.income)) + ', pengeluaran ' + escapeHtml(formatMoney(totals.expense)) + '">' +
        '<div class="bar-pair"><span class="bar bar-income" style="height:' + incomeHeight + '%"></span>' +
        '<span class="bar bar-expense" style="height:' + expenseHeight + '%"></span></div>' +
        '<span class="chart-month-label">' + monthNames[month.getMonth()] + "</span></div>";
    }).join("");
  }

  function renderGoals() {
    var container = document.getElementById("goals-list");
    if (!state.goals.length) {
      container.innerHTML = '<p class="empty-state">Belum ada impian yang ditambahkan.<br>Mulai dari satu tujuan yang ingin kamu capai.</p>';
      return;
    }
    container.innerHTML = state.goals.map(function (goal) {
      var target = finiteNumber(goal.target);
      var saved = finiteNumber(goal.savedAmount);
      var percentage = target ? Math.min(100, Math.round(saved / target * 100)) : 0;
      return '<div class="goal-item"><div class="goal-item-top">' +
        '<span class="goal-emoji" aria-hidden="true">☆</span><span class="goal-meta"><strong>' + escapeHtml(goal.name) +
        '</strong><small>' + escapeHtml(formatMoney(saved)) + " dari " + escapeHtml(formatMoney(target)) +
        "</small></span><span class=\"goal-percentage\">" + percentage + "%</span></div>" +
        '<div class="progress-track"><div class="progress-fill" style="width:' + percentage + '%"></div></div></div>';
    }).join("");
  }

  function renderTransactions() {
    var container = document.getElementById("transaction-list");
    var sortedItems = state.transactions.slice().sort(function (first, second) {
      return transactionDate(second.date) - transactionDate(first.date) ||
        String(second.createdAt || "").localeCompare(String(first.createdAt || ""));
    });
    var items = showAllTransactions ? sortedItems : sortedItems.slice(0, 5);
    document.getElementById("view-all-transactions").textContent =
      showAllTransactions ? "Tampilkan lebih sedikit ↑" : "Lihat semua →";
    if (!items.length) {
      container.innerHTML = '<p class="empty-state">Belum ada transaksi.<br>Transaksi pertamamu akan muncul di sini.</p>';
      return;
    }
    container.innerHTML = items.map(function (item) {
      var isIncome = item.type === "income";
      var description = item.note || item.category || (isIncome ? "Pemasukan" : "Pengeluaran");
      var splitNote = isIncome && (finiteNumber(item.emergencySplit) || finiteNumber(item.dreamSplit))
        ? " · Otomatis dipisah"
        : "";
      return '<div class="transaction-row"><span class="transaction-icon ' + (isIncome ? "" : "is-expense") +
        '" aria-hidden="true">' + (isIncome ? "↓" : "↑") + '</span><span class="transaction-info"><strong>' +
        escapeHtml(description) + '</strong><small>' + escapeHtml(item.category || (isIncome ? "Pemasukan" : "Pengeluaran")) +
        " · " + formatDate(item.date) + escapeHtml(splitNote) + '</small></span><span class="transaction-amount ' +
        (isIncome ? "income" : "expense") + '">' + (isIncome ? "+" : "−") + escapeHtml(formatMoney(item.amount)) +
        "</span></div>";
    }).join("");
  }

  function render() {
    renderSummary();
    renderChart();
    renderGoals();
    renderTransactions();
    document.getElementById("emergency-allocation").value = state.settings.emergencyPerIncome || "";
    document.getElementById("dream-allocation").value = state.settings.dreamPerIncome || "";
  }

  function setTransactionType(type) {
    var category = document.getElementById("transaction-category");
    var sourceGroup = document.getElementById("expense-source-group");
    var sourceLabel = document.getElementById("source-label");
    var incomeOptions = ["Gaji", "Bonus", "Usaha", "Lainnya"];
    var expenseOptions = ["Makanan", "Transportasi", "Tagihan", "Belanja", "Kesehatan", "Hiburan", "Lainnya"];
    var options = type === "income" ? incomeOptions : expenseOptions;
    category.innerHTML = options.map(function (option) {
      return "<option>" + option + "</option>";
    }).join("");
    sourceGroup.classList.toggle("hidden", type !== "expense");
    sourceLabel.textContent = type === "income" ? "Keterangan" : "Untuk apa?";
    transactionForm.elements.note.placeholder = type === "income" ? "Contoh: gaji bulanan" : "Contoh: makan siang";
    document.getElementById("transaction-message").textContent = "";
  }

  document.getElementById("open-transaction").addEventListener("click", function () {
    transactionForm.reset();
    transactionForm.elements.date.value = localDateInputValue(new Date());
    setTransactionType("income");
    transactionDialog.showModal();
  });

  document.getElementById("open-goal").addEventListener("click", function () {
    document.getElementById("goal-form").reset();
    goalDialog.showModal();
  });

  document.querySelectorAll('input[name="type"]').forEach(function (input) {
    input.addEventListener("change", function () {
      setTransactionType(input.value);
    });
  });

  document.querySelectorAll("[data-close]").forEach(function (button) {
    button.addEventListener("click", function () {
      document.getElementById(button.getAttribute("data-close")).close();
    });
  });

  transactionForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var formData = new FormData(transactionForm);
    var type = String(formData.get("type"));
    var amount = finiteNumber(formData.get("amount"));
    var date = String(formData.get("date") || "");
    var note = String(formData.get("note") || "").trim();
    var category = String(formData.get("category") || "");
    var message = document.getElementById("transaction-message");
    if (!amount || !date) {
      message.textContent = "Masukkan nominal lebih dari nol dan tanggal yang valid.";
      return;
    }
    if (type === "expense" && !note) {
      message.textContent = "Tuliskan uang ini digunakan untuk apa.";
      return;
    }
    var source = String(formData.get("source") || "available");
    if (type === "expense" && source === "emergency" && amount > state.emergencyBalance) {
      message.textContent = "Saldo dana darurat tidak mencukupi.";
      return;
    }
    if (type === "expense" && source !== "emergency" && amount > availableBalance()) {
      message.textContent = "Saldo tersedia tidak mencukupi. Kurangi nominal atau gunakan dana darurat.";
      return;
    }

    var transaction = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      type: type,
      amount: amount,
      date: date,
      category: category,
      note: note,
      source: type === "expense" ? source : "available",
      createdAt: new Date().toISOString()
    };

    if (type === "income") {
      var remaining = amount;
      var emergencySplit = Math.min(remaining, state.settings.emergencyPerIncome);
      remaining -= emergencySplit;
      var activeGoal = state.goals.find(function (goal) {
        return finiteNumber(goal.savedAmount) < finiteNumber(goal.target);
      });
      var goalRemaining = activeGoal ? Math.max(0, finiteNumber(activeGoal.target) - finiteNumber(activeGoal.savedAmount)) : 0;
      var dreamSplit = activeGoal ? Math.min(remaining, state.settings.dreamPerIncome, goalRemaining) : 0;
      state.emergencyBalance += emergencySplit;
      if (activeGoal) activeGoal.savedAmount = finiteNumber(activeGoal.savedAmount) + dreamSplit;
      transaction.emergencySplit = emergencySplit;
      transaction.dreamSplit = dreamSplit;
      transaction.goalName = activeGoal ? activeGoal.name : "";
      transaction.goalId = activeGoal ? activeGoal.id : "";
    } else if (source === "emergency") {
      state.emergencyBalance -= amount;
    }

    state.transactions.push(transaction);
    if (!saveState()) {
      state.transactions.pop();
      if (type === "income") {
        state.emergencyBalance -= transaction.emergencySplit;
        var goal = state.goals.find(function (item) { return item.id === transaction.goalId; });
        if (goal) goal.savedAmount -= transaction.dreamSplit;
      } else if (source === "emergency") {
        state.emergencyBalance += amount;
      }
      return;
    }
    transactionDialog.close();
    render();
  });

  document.getElementById("goal-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var formData = new FormData(event.currentTarget);
    var name = String(formData.get("name") || "").trim();
    var target = finiteNumber(formData.get("target"));
    if (!name || !target) return;
    state.goals.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: name,
      target: target,
      savedAmount: 0
    });
    if (!saveState()) {
      state.goals.pop();
      return;
    }
    goalDialog.close();
    render();
  });

  document.getElementById("save-settings").addEventListener("click", function () {
    var emergencyInput = document.getElementById("emergency-allocation");
    var dreamInput = document.getElementById("dream-allocation");
    var emergency = Math.max(0, Number(emergencyInput.value) || 0);
    var dream = Math.max(0, Number(dreamInput.value) || 0);
    var previous = state.settings;
    state.settings = { emergencyPerIncome: emergency, dreamPerIncome: dream };
    if (!saveState()) {
      state.settings = previous;
      return;
    }
    var status = document.getElementById("allocation-status");
    status.textContent = "Tersimpan.";
    window.setTimeout(function () { status.textContent = ""; }, 2500);
  });

  document.getElementById("view-all-transactions").addEventListener("click", function () {
    showAllTransactions = !showAllTransactions;
    renderTransactions();
    document.getElementById("transaksi").scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("today-label").textContent = new Intl.DateTimeFormat("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  }).format(new Date()).toUpperCase();
  transactionForm.elements.date.value = localDateInputValue(new Date());
  render();
}());
