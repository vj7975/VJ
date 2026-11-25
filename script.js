const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".navigation");

menuButton.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
  navigation.classList.toggle("is-open", !isOpen);
});

navigation.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation");
    navigation.classList.remove("is-open");
  });
});

const roles = ["UPSC Aspirant", "Aspiring Developer"];
const roleElement = document.querySelector(".role-word");
let roleIndex = 0;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!reducedMotion) {
  window.setInterval(() => {
    roleElement.classList.add("role-changing");
    window.setTimeout(() => {
      roleIndex = (roleIndex + 1) % roles.length;
      roleElement.textContent = roles[roleIndex];
      roleElement.classList.remove("role-changing");
    }, 180);
  }, 2600);
}

const portrait = document.querySelector(".portrait-image");
const portraitFallback = document.querySelector(".portrait-fallback");
const showPortrait = () => {
  portrait.hidden = false;
  portraitFallback.hidden = true;
};

if (portrait.complete && portrait.naturalWidth > 0) {
  showPortrait();
} else {
  portrait.addEventListener("load", showPortrait, { once: true });
}

document.querySelector("#current-year").textContent = new Date().getFullYear();

let revealObserver = null;
if ("IntersectionObserver" in window && !reducedMotion) {
  revealObserver = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));
} else {
  document.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));
}

const testimonialGrid = document.querySelector(".testimonial-grid");
const testimonialEditor = document.querySelector("#testimonial-editor");
const testimonialEditorList = document.querySelector("#testimonial-editor-list");
const testimonialStatus = document.querySelector("#testimonial-status");
const testimonialToggle = document.querySelector("#testimonial-edit-toggle");
const testimonialPlaceholder = testimonialGrid.querySelector(".testimonial-photo svg").cloneNode(true);
const testimonialStorageKey = "vinay-portfolio-testimonials";
const testimonialEditMode = new URLSearchParams(window.location.search).get("editTestimonials") === "1";
const initialTestimonials = Array.from(testimonialGrid.querySelectorAll(".testimonial-item")).map((item) => ({
  name: item.querySelector("h3").textContent.trim(),
  review: item.querySelector("p").textContent.trim(),
  photo: ""
}));
let testimonials = initialTestimonials;

if (testimonialEditMode) {
  document.querySelector(".testimonial-tools").hidden = false;
}

function showTestimonialStatus(message) {
  testimonialStatus.textContent = message;
}

function isValidPortraitUrl(value) {
  if (!value) {
    return true;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch (error) {
    return false;
  }
}

function renderTestimonials() {
  if (revealObserver) {
    Array.from(testimonialGrid.children).forEach((item) => revealObserver.unobserve(item));
  }

  const fragment = document.createDocumentFragment();
  testimonials.forEach((person) => {
    const article = document.createElement("article");
    article.className = "testimonial-item reveal";

    const portrait = document.createElement("div");
    portrait.className = "testimonial-photo";
    portrait.setAttribute("role", "img");
    portrait.setAttribute("aria-label", person.photo ? `${person.name} portrait` : `Sample portrait placeholder for ${person.name}`);
    if (person.photo) {
      const image = document.createElement("img");
      image.src = person.photo;
      image.alt = `${person.name} portrait`;
      image.addEventListener("error", () => {
        portrait.replaceChildren(testimonialPlaceholder.cloneNode(true));
        showTestimonialStatus(`Could not load ${person.name}'s portrait. Check its image URL.`);
      }, { once: true });
      portrait.append(image);
    } else {
      portrait.append(testimonialPlaceholder.cloneNode(true));
    }

    const name = document.createElement("h3");
    name.textContent = person.name;
    const review = document.createElement("p");
    review.textContent = person.review;
    article.append(portrait, name, review);
    fragment.append(article);
  });
  testimonialGrid.replaceChildren(fragment);

  testimonialGrid.querySelectorAll(".testimonial-item").forEach((item) => {
    if (revealObserver) {
      revealObserver.observe(item);
    } else {
      item.classList.add("is-visible");
    }
  });
}

function createTestimonialEditorRow(person, index) {
  const row = document.createElement("fieldset");
  row.className = "testimonial-editor-row";

  const legend = document.createElement("legend");
  legend.textContent = `PERSON ${String(index + 1).padStart(2, "0")}`;
  row.append(legend);

  const fields = [
    { label: "Name", className: "testimonial-name-input", value: person.name, type: "text", required: true },
    { label: "Feedback", className: "testimonial-review-input", value: person.review, type: "textarea", required: true },
    { label: "Portrait image URL (optional)", className: "testimonial-photo-input", value: person.photo, type: "url", required: false }
  ];

  fields.forEach((field) => {
    const label = document.createElement("label");
    label.textContent = field.label;
    const id = `testimonial-${field.className}-${index}`;
    let input;
    if (field.type === "textarea") {
      input = document.createElement("textarea");
    } else {
      input = document.createElement("input");
      input.type = field.type;
      input.placeholder = field.type === "url" ? "https://example.com/photo.jpg" : "";
    }
    input.id = id;
    input.className = field.className;
    input.value = field.value;
    input.required = field.required;
    input.addEventListener("input", () => input.setCustomValidity(""));
    label.htmlFor = id;
    label.append(input);
    row.append(label);
  });

  const removeButton = document.createElement("button");
  removeButton.className = "remove-testimonial";
  removeButton.type = "button";
  removeButton.textContent = "Remove person";
  removeButton.addEventListener("click", () => row.remove());
  row.append(removeButton);
  return row;
}

function populateTestimonialEditor() {
  testimonialEditorList.replaceChildren();
  testimonials.forEach((person, index) => {
    testimonialEditorList.append(createTestimonialEditorRow(person, index));
  });
}

function setTestimonialEditorOpen(isOpen) {
  testimonialEditor.hidden = !isOpen;
  testimonialToggle.setAttribute("aria-expanded", String(isOpen));
  testimonialToggle.textContent = isOpen ? "Close editor" : "Edit testimonials";
  if (isOpen) {
    populateTestimonialEditor();
  }
}

try {
  const savedTestimonials = localStorage.getItem(testimonialStorageKey);
  if (savedTestimonials) {
    const parsedTestimonials = JSON.parse(savedTestimonials);
    const isValidData = Array.isArray(parsedTestimonials) && parsedTestimonials.every((person) =>
      person &&
      typeof person.name === "string" &&
      person.name.trim() &&
      typeof person.review === "string" &&
      person.review.trim() &&
      typeof person.photo === "string" &&
      isValidPortraitUrl(person.photo)
    );
    if (!isValidData) {
      throw new TypeError("Saved testimonial data has an invalid format.");
    }
    testimonials = parsedTestimonials;
  }
} catch (error) {
  console.error("Unable to load saved testimonials.", error);
  showTestimonialStatus("Could not load saved testimonials. The sample entries are shown.");
}

renderTestimonials();

testimonialToggle.addEventListener("click", () => {
  setTestimonialEditorOpen(testimonialEditor.hidden);
});

document.querySelector("#add-testimonial").addEventListener("click", () => {
  const person = {
    name: "",
    review: "Sample testimonial — replace with genuine feedback.",
    photo: ""
  };
  testimonialEditorList.append(createTestimonialEditorRow(person, testimonialEditorList.children.length));
  testimonialEditorList.lastElementChild.querySelector(".testimonial-name-input").focus();
});

document.querySelector("#cancel-testimonial-edit").addEventListener("click", () => {
  setTestimonialEditorOpen(false);
  showTestimonialStatus("Changes were not saved.");
});

testimonialEditor.addEventListener("submit", (event) => {
  event.preventDefault();
  const rows = Array.from(testimonialEditorList.querySelectorAll(".testimonial-editor-row"));
  const nextTestimonials = [];

  for (const row of rows) {
    const name = row.querySelector(".testimonial-name-input");
    const review = row.querySelector(".testimonial-review-input");
    const photo = row.querySelector(".testimonial-photo-input");
    const photoUrl = photo.value.trim();

    if (!name.value.trim()) {
      name.setCustomValidity("Enter a name.");
      name.reportValidity();
      return;
    }
    if (!review.value.trim()) {
      review.setCustomValidity("Enter testimonial feedback.");
      review.reportValidity();
      return;
    }
    if (!isValidPortraitUrl(photoUrl)) {
      photo.setCustomValidity("Enter a valid http or https image URL.");
      photo.reportValidity();
      return;
    }
    nextTestimonials.push({
      name: name.value.trim(),
      review: review.value.trim(),
      photo: photoUrl
    });
  }

  if (!testimonialEditor.reportValidity()) {
    return;
  }

  try {
    localStorage.setItem(testimonialStorageKey, JSON.stringify(nextTestimonials));
    testimonials = nextTestimonials;
    renderTestimonials();
    setTestimonialEditorOpen(false);
    showTestimonialStatus("Testimonials saved in this browser.");
  } catch (error) {
    console.error("Unable to save testimonials.", error);
    showTestimonialStatus("Could not save changes. Check this browser's storage settings.");
  }
});
