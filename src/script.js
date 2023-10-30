// Constants
const API_URL = "https://feature-flags-api.onrender.com/flags";
const FLAGS_PER_PAGE = 10;

// DOM elements
const modal = document.getElementById("confirmationModal");
const container = document.querySelector(".container");
const searchInput = document.getElementById("searchInput");
const closeModalBtn = document.querySelector(".close-btn");
const flagGroupingTags = document.querySelector("#flagGroupingTags");
const groupingContainer = document.querySelector(".tag-container");
const saveButton = document.getElementById("saveFeatureFlag");
const featureFlagForm = document.getElementById("featureFlagForm");

const isGroupFlagCheckbox = document.getElementById("isGroupFlag");
const childFlagNameContainer = document.getElementById(
  "childFlagNameContainer"
);
const childFlagNameInput = document.getElementById("childFlagName");

// State variables
let currentlyEditing = null;
let flagsArray = [];
let currentFlags = [];
let currentPage = 1;
let initSearchState = [];
let flagGroups = [];
let selectedGroups = [];
let predefinedValues = [];

// Utility functions
const fetchData = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch data");
    }
    return response.json();
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

function extractUniqueGroups(flags) {
  let allGroups = [];

  for (const key in flags) {
    if (flags[key].flagGroups && Array.isArray(flags[key].flagGroups)) {
      allGroups = allGroups.concat(flags[key].flagGroups);
    }
  }

  // Remove duplicates using Set and then convert it back to array
  const uniqueGroups = [...new Set(allGroups)];
  return uniqueGroups;
}

const createFeatureFlag = async (flagData) => {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(flagData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `HTTP error! Status: ${response.status}, Message: ${errorData.error}`
      );
    }

    await response.json();
    initSearchState = [];
    await fetchFeatureFlags();
    featureFlagForm.reset();
    showModal("Feature flag added successfully!");
  } catch (error) {
    console.error(error, "Error saving feature flag.");
  }
};

const updateFlag = async (flag) => {
  try {
    const response = await fetch(`${API_URL}/${flag.extid}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(flag)
    });
    if (!response.ok) {
      throw new Error(`Failed to update feature flag with name ${flag.name}`);
    }
    showModal(`Feature flag ${flag.name} updated successfully!`);
    await fetchFeatureFlags();
  } catch (error) {
    console.error(`Error updating feature flag: ${error.message}`);
  }
};

const deleteFlag = async (extid) => {
  try {
    const response = await fetch(`${API_URL}/${extid}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Failed to delete feature flag with name ${extid}`);
    }

    initSearchState = [];
    await fetchFeatureFlags();
  } catch (error) {
    console.error(`Error deleting feature flag: ${error.message}`);
  }
};

const customConfirm = (message, callback) => {
  const customConfirmModal = document.getElementById("customConfirmModal");
  const confirmYes = document.getElementById("confirmYes");
  const confirmNo = document.getElementById("confirmNo");
  document.getElementById("confirmMessage").innerText = message;
  customConfirmModal.style.display = "block";

  confirmYes.onclick = function () {
    callback(true);
    customConfirmModal.style.display = "none";
  };

  confirmNo.onclick = function () {
    callback(false);
    customConfirmModal.style.display = "none";
  };
};

const showModal = (message) => {
  document.getElementById("modalMessage").innerText = message;
  modal.style.display = "block";
};

const paginateFlags = (flags, page, perPage) => {
  const start = (page - 1) * perPage;
  const end = start + perPage;
  return flags.slice(start, end);
};

const populateTable = (flagsObject) => {
  const tableBody = document.getElementById("flagsTableBody");
  tableBody.innerHTML = "";

  flagsArray = Object.values(flagsObject);

  if (initSearchState.length === 0) {
    initSearchState = Object.values(flagsObject);
  }

  flagsArray.sort((a, b) => b.creationDate._seconds - a.creationDate._seconds);

  if (flagsArray.length === 0) {
    const noRowsRow = tableBody.insertRow();
    const noRowsCell = noRowsRow.insertCell();
    noRowsCell.colSpan = 10;
    noRowsCell.textContent = "There are no rows in the table.";
  } else
    flagsArray.forEach((flag) => {
      const row = createFlagRow(flag);
      tableBody.appendChild(row);
    });
};

const createFlagRow = (flag) => {
  const row = document.createElement("tr");

  row.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openEditForm(flag, row);
  });

  const fields = [
    "name",
    "childFlagName",
    "description",
    "flagValue",
    "environment",
    "restrictionLevel",
    "flagGroups",
    "creationDate",
    "modifiedDate"
  ];

  fields.forEach((field) => {
    const cell = document.createElement("td");
    if (field === "flagGroups") {
      cell.innerHTML = formatField(flag, field) || "-";
    } else {
      cell.textContent = formatField(flag, field) || "-";
    }
    cell.setAttribute(
      "data-label",
      field.charAt(0).toUpperCase() + field.slice(1)
    );
    row.appendChild(cell);
  });

  const deleteCell = document.createElement("td");
  const deleteButton = createDeleteButton(flag);
  deleteCell.appendChild(deleteButton);
  row.appendChild(deleteCell);

  return row;
};

const formatField = (flag, field) => {
  if (field === "creationDate" || field === "modifiedDate") {
    const jsDate = new Date(flag[field]._seconds * 1000);
    return jsDate.toLocaleDateString();
  } else if (field === "flagGroups" && Array.isArray(flag[field])) {
    return flag[field]
      .map((group, index) => `<span class="hash-group">${group}</span>`)
      .join(" ");
  } else {
    return flag[field];
  }
};

const createDeleteButton = (flag) => {
  const deleteButton = document.createElement("button");
  deleteButton.classList.add("show-delete");
  deleteButton.innerHTML = `  <span class="mdi mdi-delete mdi-24px"></span>
  <span class="mdi mdi-delete-empty mdi-24px"></span>
  <span>Delete</span>`;
  deleteButton.textContent = "Delete";
  deleteButton.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    customConfirm(
      "Are you sure you want to delete this feature flag?",
      (isConfirmed) => {
        if (isConfirmed) {
          deleteFlag(flag.extid);
        }
      }
    );
  };
  return deleteButton;
};

const openEditForm = (flag, row) => {
  if (currentlyEditing) {
    closeEditForm(currentlyEditing);
  }
  currentlyEditing = row;

  Array.from(row.cells).forEach((cell) => (cell.style.display = "none"));

  const form = createEditForm(flag);
  const formCell = row.insertCell();
  formCell.colSpan = 10;
  formCell.appendChild(form);

  isGroupFlagCheckbox.checked = flag.isGroupFlag || false;
  if (flag.isGroupFlag) {
    childFlagNameInput.value = flag.childName || "";
    childFlagNameContainer.style.display = "";
  } else {
    childFlagNameContainer.style.display = "none";
  }
};

const createEditForm = (flag) => {
  const form = document.createElement("form");
  form.setAttribute("class", "editForm");

  const inputs = [
    { label: "Name", value: flag.name, type: "text", id: "editName" },
    {
      label: "Description",
      value: flag.description,
      type: "textarea",
      id: "editDescription"
    },
    {
      label: "Flag Value",
      value: flag.flagValue,
      type: "select",
      options: ["boolean", "text", "json"],
      id: "editFlagValue"
    },
    {
      label: "Environment",
      value: flag.environment,
      type: "select",
      options: ["production", "staging", "development"],
      id: "editEnvironment"
    },
    {
      label: "Restriction Level",
      value: flag.restrictionLevel,
      type: "select",
      options: ["public", "private"],
      id: "editRestrictionLevel"
    }
  ];
  if (flag.childFlagName) {
    const childFlagInput = {
      label: "Child Flag Name",
      value: flag.childFlagName,
      type: "text",
      id: "editChildFlagName"
    };
    inputs.splice(1, 0, childFlagInput);
  }

  inputs.forEach((inputData) => {
    const label = document.createElement("label");
    label.textContent = inputData.label;
    form.appendChild(label);

    if (inputData.type === "select") {
      const select = createSelectInput(inputData);
      select.addEventListener("click", (e) => e.stopPropagation());

      form.appendChild(select);
    } else if (inputData.type === "textarea") {
      const textarea = createTextareaInput(inputData);
      textarea.addEventListener("click", (e) => e.stopPropagation());

      form.appendChild(textarea);
    } else {
      const input = createTextInput(inputData);
      input.addEventListener("click", (e) => e.stopPropagation());
      form.appendChild(input);
    }
  });

  const saveBtn = createSaveButton(flag);
  const cancelBtn = createCancelButton();

  form.appendChild(saveBtn);
  form.appendChild(cancelBtn);

  return form;
};

const createTextInput = (inputData) => {
  const input = document.createElement("input");
  input.setAttribute("type", inputData.type);
  input.setAttribute("name", inputData.id);
  input.id = inputData.id;
  input.value = inputData.value;
  return input;
};

const createTextareaInput = (inputData) => {
  const textarea = document.createElement("textarea");
  textarea.id = inputData.id;
  textarea.value = inputData.value;
  return textarea;
};

const createSelectInput = (inputData) => {
  const select = document.createElement("select");
  select.id = inputData.id;
  inputData.options.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt;
    option.textContent = opt;
    if (opt === inputData.value) option.selected = true;
    select.appendChild(option);
  });
  return select;
};

const createSaveButton = (flag) => {
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    flag.name = document.getElementById("editName").value;
    flag.description = document.getElementById("editDescription").value;
    flag.flagValue = document.getElementById("editFlagValue").value;
    flag.environment = document.getElementById("editEnvironment").value;
    flag.restrictionLevel = document.getElementById(
      "editRestrictionLevel"
    ).value;
    updateFlag(flag);
    closeEditForm(currentlyEditing);
  });
  return saveBtn;
};

const createCancelButton = () => {
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeEditForm(currentlyEditing);
  });
  return cancelBtn;
};

const closeEditForm = (row) => {
  const formCell = row.querySelector(".editForm").parentNode;
  formCell.remove();
  if (currentlyEditing === row) {
    currentlyEditing = null;
  }
  Array.from(row.cells).forEach((cell) => (cell.style.display = ""));
};

const fetchFeatureFlags = async () => {
  try {
    const flags = await fetchData(API_URL);
    populateTable(flags);
    currentFlags = flagsArray;
    updateTableDisplay();
    predefinedValues = extractUniqueGroups(flags);
  } catch (error) {
    console.error("There was an error fetching the feature flags", error);
  }
};

const updateTableDisplay = () => {
  const paginatedFlags = paginateFlags(
    currentFlags,
    currentPage,
    FLAGS_PER_PAGE
  );
  populateTable(paginatedFlags);

  document.getElementById("prevBtn").disabled = currentPage === 1;
  document.getElementById("nextBtn").disabled =
    paginatedFlags.length < FLAGS_PER_PAGE;
  document.getElementById(
    "pageIndicator"
  ).textContent = `${currentPage} / ${Math.ceil(
    currentFlags.length / FLAGS_PER_PAGE
  )}`;
};

const goToFirstPage = () => {
  currentPage = 1;
  updateTableDisplay();
};
const goToLastPage = () => {
  currentPage = Math.ceil(currentFlags.length / FLAGS_PER_PAGE);
  updateTableDisplay();
};
const nextPage = () => {
  currentPage++;
  updateTableDisplay();
};

const prevPage = () => {
  currentPage--;
  updateTableDisplay();
};

const validateForm = () => {
  const flagName = document.getElementById("flagName").value;
  let childFlagName = isGroupFlagCheckbox.checked
    ? document.getElementById("childFlagName").value
    : true;
  const flagDescription = document.getElementById("flagDescription").value;
  const flagValueType = document.getElementById("flagValueType").value;

  const isValid = flagName && flagDescription && flagValueType && childFlagName;
  saveButton.disabled = !isValid;
};

const handleFormSubmit = async (e) => {
  e.preventDefault();
  e.stopPropagation();

  const valueType = document.getElementById("flagValueType").value;
  let flagValue;

  switch (valueType) {
    case "boolean":
      flagValue = "boolean";
      break;

    case "text":
      flagValue = "text";
      break;

    case "json":
      flagValue = "json";
      break;

    default:
      break;
  }

  const flagData = {
    name: document.getElementById("flagName").value,
    childFlagName: document.getElementById("childFlagName").value,
    description: document.getElementById("flagDescription").value,
    flagValue,
    environment: document.getElementById("flagEnvironment").value,
    restrictionLevel: document.getElementById("restrictionLevel").value,
    isGroupFlag: isGroupFlagCheckbox.checked,
    flagGroups
  };
  await createFeatureFlag(flagData);
};

const searchAndUpdateTable = () => {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  currentFlags = [...initSearchState].filter((flag) =>
    flag.name.toLowerCase().includes(searchTerm)
  );
  currentPage = 1;
  updateTableDisplay();
};

const addTag = (tagValue) => {
  const tagElem = document.createElement("p");
  tagElem.textContent = tagValue;
  tagElem.classList.add("tag");

  tagElem.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeTag(tagValue, tagElem);
  });

  groupingContainer.appendChild(tagElem);
};

const removeTag = (tagValue, tagElem) => {
  groupingContainer.removeChild(tagElem);

  const index = flagGroups.indexOf(tagValue);
  if (index > -1) {
    flagGroups.splice(index, 1);
  }
  const selectedIndex = selectedGroups.indexOf(tagValue);
  if (selectedIndex > -1) {
    selectedGroups.splice(selectedIndex, 1);
  }
};

// AutoComplete functions

const initializeAutoComplete = () => {
  const flagGroupingTagsInput = getFlagGroupingTagsInput();
  const dropdown = createDropdownForInput(flagGroupingTagsInput);

  flagGroupingTagsInput.addEventListener("input", function () {
    displayMatchingValues(this.value, dropdown);
  });
};

const getFlagGroupingTagsInput = () => {
  return document.getElementById("flagGroupingTags");
};

const createDropdownForInput = (inputElement) => {
  const dropdown = document.createElement("div");
  dropdown.classList.add("dropdown-content");
  inputElement.parentElement.appendChild(dropdown);
  return dropdown;
};

const displayMatchingValues = (filter, dropdown) => {
  const matchedValues = filterValues(filter, predefinedValues);

  dropdown.innerHTML = "";

  matchedValues.forEach((value) => {
    const item = createDropdownItem(value, dropdown);
    dropdown.appendChild(item);
  });
};

const filterValues = (filter, values) => {
  const lowercaseFilter = filter.toLowerCase();
  return values.filter(
    (value) =>
      value.toLowerCase().includes(lowercaseFilter) &&
      !selectedGroups.includes(value)
  );
};

const createDropdownItem = (value, dropdown) => {
  const item = document.createElement("div");
  item.textContent = value;

  item.addEventListener("click", function () {
    addTag(value);
    flagGroups.push(value);
    selectedGroups.push(value);
    hideDropdown(dropdown);
    clearFlagGroupingTagsInput();
  });

  return item;
};

const hideDropdown = (dropdown) => {
  dropdown.innerHTML = "";
};

const clearFlagGroupingTagsInput = () => {
  const flagGroupingTagsInput = getFlagGroupingTagsInput();
  flagGroupingTagsInput.value = "";
};

const setupOutsideClickListener = () => {
  document.addEventListener("click", function (event) {
    const flagGroupingTagsInput = getFlagGroupingTagsInput();
    const dropdown = flagGroupingTagsInput.parentElement.querySelector(
      ".dropdown-content"
    );

    if (
      !dropdown.contains(event.target) &&
      !flagGroupingTagsInput.contains(event.target)
    ) {
      hideDropdown(dropdown);
    }
  });
};

// Event listeners
saveButton.addEventListener("click", handleFormSubmit);
searchInput.addEventListener("input", () =>
  searchAndUpdateTable(searchInput.value)
);
document.getElementById("prevBtn").addEventListener("click", prevPage);
document.getElementById("nextBtn").addEventListener("click", nextPage);
featureFlagForm.addEventListener("input", validateForm);
featureFlagForm.addEventListener("change", validateForm);

document
  .getElementById("firstPageBtn")
  .addEventListener("click", goToFirstPage);
document.getElementById("lastPageBtn").addEventListener("click", goToLastPage);

isGroupFlagCheckbox.addEventListener("change", () => {
  if (isGroupFlagCheckbox.checked) {
    childFlagNameInput.disabled = false;
    childFlagNameContainer.classList.remove("disable-child-flag");
    document.getElementById("childFlagName").value = "";
  } else {
    childFlagNameInput.disabled = true;
    childFlagNameContainer.classList.add("disable-child-flag");
    document.getElementById("childFlagName").value = "";
  }
});

flagGroupingTags.addEventListener("keyup", (event) => {
  if (event.which === 13 && flagGroupingTags.value.length > 0) {
    event.preventDefault();
    event.stopPropagation();
    const tagValue = flagGroupingTags.value.trim();

    if (!flagGroups.includes(tagValue)) {
      addTag(tagValue);
      flagGroups.push(tagValue);
    }

    flagGroupingTags.value = "";
  }
});

// init
fetchFeatureFlags();
initializeAutoComplete();
setupOutsideClickListener();

closeModalBtn.onclick = () => {
  modal.style.display = "none";
};

window.onclick = (event) => {
  if (event.target === modal || event.target === container) {
    modal.style.display = "none";
  }
};
